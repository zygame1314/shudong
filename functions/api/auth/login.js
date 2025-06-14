import { SignJWT } from 'jose';
const addCorsHeaders = (headers = {}) => {
    const allowedOrigin = '*';
    const plainHeaders = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
    return {
        ...plainHeaders,
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
    };
};
class CookieJar {
    constructor() {
        this.cookies = [];
    }
    parseCookie(cookieString) {
        const parts = cookieString.split(';').map(p => p.trim());
        const [name, value] = parts[0].split('=');
        if (!name || value === undefined) return null;
        const cookie = {
            name,
            value,
            domain: '',
            path: '/',
            expires: null,
            secure: false,
            httpOnly: false
        };
        for (let i = 1; i < parts.length; i++) {
            let [key, val] = parts[i].split('=');
            key = key.toLowerCase();
            if (key === 'domain') cookie.domain = val;
            if (key === 'path') cookie.path = val;
            if (key === 'expires') cookie.expires = new Date(val);
            if (key === 'secure') cookie.secure = true;
            if (key === 'httponly') cookie.httpOnly = true;
        }
        return cookie;
    }
    addFromHeaders(setCookieArray, requestUrl) {
        if (!setCookieArray || setCookieArray.length === 0) return;
        const requestUrlObj = new URL(requestUrl);
        setCookieArray.forEach(cookieString => {
            const cookie = this.parseCookie(cookieString);
            if (!cookie) return;
            if (!cookie.domain) {
                cookie.domain = requestUrlObj.hostname;
            }
            this.cookies = this.cookies.filter(c =>
                !(c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path)
            );
            this.cookies.push(cookie);
        });
    }
    getCookiesForUrl(urlString) {
        const url = new URL(urlString);
        const now = new Date();
        return this.cookies.filter(cookie => {
            const domainMatch = url.hostname.endsWith(cookie.domain);
            const pathMatch = url.pathname.startsWith(cookie.path);
            const notExpired = !cookie.expires || cookie.expires > now;
            const secureMatch = !cookie.secure || url.protocol === 'https протокол:';
            return domainMatch && pathMatch && notExpired && secureMatch;
        });
    }
    toHeaderStringForUrl(urlString) {
        return this.getCookiesForUrl(urlString)
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
    }
}
async function getLoginPrerequisites(url, cookieJar, userAgent) {
    let lt = '', execution = '';
    const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
    cookieJar.addFromHeaders(response.headers.getSetCookie(), url);
    const transformedStream = new HTMLRewriter()
        .on('input[name="lt"]', { element(el) { lt = el.getAttribute('value'); } })
        .on('input[name="execution"]', { element(el) { execution = el.getAttribute('value'); } })
        .transform(response);
    await new Response(transformedStream.body).text();
    if (!lt || !execution) {
        throw new Error('无法从登录页获取动态表单参数(lt/execution)。');
    }
    return { lt, execution };
}
async function performLoginAndRedirects(url, formData, cookieJar, userAgent) {
    let currentUrl = url;
    const postResponse = await fetch(currentUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': userAgent,
            'Cookie': cookieJar.toHeaderStringForUrl(currentUrl),
            'Referer': currentUrl
        },
        body: formData.toString(),
        redirect: 'manual'
    });
    if (postResponse.status !== 302) { throw new Error('学号或密码错误。'); }
    cookieJar.addFromHeaders(postResponse.headers.getSetCookie(), currentUrl);
    let nextUrl = postResponse.headers.get('location');
    if (!nextUrl) throw new Error('登录后重定向缺少Location头。');
    for (let i = 0; i < 10; i++) {
        const referer = currentUrl;
        currentUrl = nextUrl;
        const redirectResponse = await fetch(currentUrl, {
            headers: {
                'User-Agent': userAgent,
                'Cookie': cookieJar.toHeaderStringForUrl(currentUrl),
                'Referer': referer
            },
            redirect: 'manual'
        });
        cookieJar.addFromHeaders(redirectResponse.headers.getSetCookie(), currentUrl);
        if (redirectResponse.status >= 200 && redirectResponse.status < 300) break;
        if (redirectResponse.status >= 301 && redirectResponse.status <= 303) {
            const location = redirectResponse.headers.get('location');
            if (!location) throw new Error('重定向缺少Location头。');
            nextUrl = new URL(location, currentUrl).toString();
        } else {
            throw new Error(`重定向链中断，状态码: ${redirectResponse.status}`);
        }
    }
}
async function verifySessionAndGetUser(cookieJar, userAgent) {
    const apiUrl = `https://one.ccnu.edu.cn/getLoginUser?_t=${Math.random()}`;
    const response = await fetch(apiUrl, {
        headers: {
            'User-Agent': userAgent,
            'Cookie': cookieJar.toHeaderStringForUrl(apiUrl),
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://one.ccnu.edu.cn/default/index.html'
        }
    });
    const userInfo = await response.json();
    if (userInfo.errcode !== '0' || !userInfo.data || !userInfo.data.userAccount || !userInfo.data.userName) {
        throw new Error('会话无效或无法获取关键用户信息。');
    }
    return {
        account: userInfo.data.userAccount,
        name: userInfo.data.userName,
        category: userInfo.data.categoryName
    };
}
async function issueInternalJwt(userData, jwtSecret) {
    const secret = new TextEncoder().encode(jwtSecret);
    return await new SignJWT(userData)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setSubject(userData.account)
        .setExpirationTime('24h')
        .sign(secret);
}
export async function onRequestPost({ request, env }) {
    if (!env.JWT_SECRET) {
        console.error("环境变量'JWT_SECRET'未设置！");
        return new Response(JSON.stringify({ success: false, error: '服务器内部配置错误。' }), { status: 500, headers: addCorsHeaders() });
    }
    try {
        const { username, password } = await request.json();
        if (!username || !password) {
            return new Response(JSON.stringify({ success: false, error: '需要提供学号和密码。' }), { status: 400, headers: addCorsHeaders() });
        }
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const cookieJar = new CookieJar();
        const preflightUrl = "https://one.ccnu.edu.cn/";
        const preflightResponse = await fetch(preflightUrl, { headers: { 'User-Agent': userAgent } });
        cookieJar.addFromHeaders(preflightResponse.headers.getSetCookie(), preflightUrl);
        const serviceUrl = "https://one.ccnu.edu.cn/auth-protocol-core/loginSuccess?sessionToken=1406f29e867c49ab9e88570ab15a266d";
        const loginPageUrl = `https://account.ccnu.edu.cn/cas/login?service=${encodeURIComponent(serviceUrl)}`;
        const { lt, execution } = await getLoginPrerequisites(loginPageUrl, cookieJar, userAgent);
        const formData = new URLSearchParams({
            username, password, lt, execution,
            _eventId: 'submit', submit: '登录'
        });
        await performLoginAndRedirects(loginPageUrl, formData, cookieJar, userAgent);
        const userData = await verifySessionAndGetUser(cookieJar, userAgent);
        const token = await issueInternalJwt(userData, env.JWT_SECRET);
        return new Response(JSON.stringify({ success: true, token, user: userData }), {
            headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
    } catch (error) {
        console.error("模拟登录流程失败:", error.message);
        const friendlyError = error.message.includes('学号或密码错误') ? error.message : '认证流程中发生未知错误。';
        const errorResponse = {
            success: false,
            error: friendlyError,
        };
        const status = error.message.includes('学号或密码错误') ? 401 : 500;
        return new Response(JSON.stringify(errorResponse), { status, headers: addCorsHeaders({ 'Content-Type': 'application/json' }) });
    }
}
export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: addCorsHeaders(),
        });
    }
    if (context.request.method === 'POST') {
        return onRequestPost(context);
    }
    return new Response('Method Not Allowed', { status: 405, headers: addCorsHeaders() });
}
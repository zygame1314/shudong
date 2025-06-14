import { SignJWT } from 'https://esm.sh/jose@5.6.3';
import { HTMLRewriter } from 'https://esm.sh/html-rewriter';
class CookieJar {
    constructor() {
        this.cookies = new Map();
    }
    addFromHeaders(setCookieHeader) {
        if (!setCookieHeader) return;
        const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader.split(/, (?=[^;]+=[^;]+;)/);
        cookies.forEach(cookieString => {
            const parts = cookieString.split(';')[0].split('=');
            if (parts.length >= 2 && parts[0] && parts[1]) {
                this.cookies.set(parts[0].trim(), parts[1].trim());
            }
        });
    }
    toHeaderString() {
        return Array.from(this.cookies.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
    }
}
async function getLoginPrerequisites(url, cookieJar, userAgent) {
    let lt = '', execution = '';
    const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
    cookieJar.addFromHeaders(response.headers.get('set-cookie'));
    const transformedResponse = new HTMLRewriter()
        .on('input[name="lt"]', { element(el) { lt = el.getAttribute('value'); } })
        .on('input[name="execution"]', { element(el) { execution = el.getAttribute('value'); } })
        .transform(response);
    await transformedResponse.text();
    if (!lt || !execution) {
        throw new Error('无法从登录页获取动态表单参数(lt/execution)。');
    }
    return { lt, execution };
}
async function performLoginAndRedirects(url, formData, cookieJar, userAgent) {
    const postResponse = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': userAgent,
            'Cookie': cookieJar.toHeaderString(),
            'Referer': url
        },
        body: formData.toString(),
        redirect: 'manual'
    });
    if (postResponse.status !== 302) {
        throw new Error('学号或密码错误。');
    }
    cookieJar.addFromHeaders(postResponse.headers.get('set-cookie'));
    let nextUrl = postResponse.headers.get('location');
    for (let i = 0; i < 10; i++) {
        const redirectResponse = await fetch(nextUrl, {
            headers: { 'User-Agent': userAgent, 'Cookie': cookieJar.toHeaderString() },
            redirect: 'manual'
        });
        cookieJar.addFromHeaders(redirectResponse.headers.get('set-cookie'));
        if (redirectResponse.status >= 200 && redirectResponse.status < 300) break;
        if (redirectResponse.status === 301 || redirectResponse.status === 302 || redirectResponse.status === 303) {
            const location = redirectResponse.headers.get('location');
            if (!location) throw new Error('重定向缺少Location头。');
            nextUrl = new URL(location, redirectResponse.url).toString();
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
            'Cookie': cookieJar.toHeaderString(),
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://one.ccnu.edu.cn/default/index.html'
        }
    });
    const userInfo = await response.json();
    if (userInfo.errcode !== '0' || !userInfo.data || !userInfo.data.userAccount) {
        throw new Error('会话无效或无法获取用户信息。');
    }
    return {
        account: userInfo.data.userAccount,
        name: userInfo.data.userName,
        category: userInfo.data.categoryName,
        isLifer: userInfo.data.deptName.includes("生命科学")
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
        return new Response(JSON.stringify({ success: false, error: '服务器内部配置错误。' }), { status: 500 });
    }
    try {
        const { username, password } = await request.json();
        if (!username || !password) {
            return new Response(JSON.stringify({ success: false, error: '需要提供学号和密码。' }), { status: 400 });
        }
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const cookieJar = new CookieJar();
        const serviceUrl = "https://one.ccnu.edu.cn/auth-protocol-core/loginSuccess?sessionToken=4b66ac55cd454ae68c52b391b1bab891";
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
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("模拟登录流程失败:", error.message);
        const friendlyError = error.message.includes('学号或密码错误') ? error.message : '认证流程中发生未知错误。';
        return new Response(JSON.stringify({ success: false, error: friendlyError }), { status: error.message.includes('学号或密码错误') ? 401 : 500 });
    }
}
export async function onRequest(context) {
    if (context.request.method === 'POST') {
        return onRequestPost(context);
    }
    return new Response('Method Not Allowed', { status: 405 });
}
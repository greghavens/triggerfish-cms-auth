function renderBody(status, content) {
  const html = `
  <script>
    const receiveMessage = (message) => {
      window.opener.postMessage(
        'authorization:github:${status}:${JSON.stringify(content)}',
        message.origin
      );
      window.removeEventListener("message", receiveMessage, false);
    }
    window.addEventListener("message", receiveMessage, false);
    window.opener.postMessage("authorizing:github", "*");
  </script>
  `;
  return new Blob([html]);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/auth") {
      const redirectUrl = new URL("https://github.com/login/oauth/authorize");
      redirectUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      redirectUrl.searchParams.set("redirect_uri", url.origin + "/api/callback");
      redirectUrl.searchParams.set("scope", "repo user");
      redirectUrl.searchParams.set(
        "state",
        crypto.getRandomValues(new Uint8Array(12)).join("")
      );
      return Response.redirect(redirectUrl.href, 301);
    }

    if (url.pathname === "/api/callback") {
      const code = url.searchParams.get("code");
      const response = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "triggerfish-cms-auth",
            accept: "application/json",
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        }
      );
      const result = await response.json();
      if (result.error) {
        return new Response(renderBody("error", result), {
          headers: { "content-type": "text/html;charset=UTF-8" },
          status: 401,
        });
      }
      return new Response(
        renderBody("success", { token: result.access_token, provider: "github" }),
        {
          headers: { "content-type": "text/html;charset=UTF-8" },
          status: 200,
        }
      );
    }

    return new Response("Triggerfish CMS Auth", { status: 200 });
  },
};

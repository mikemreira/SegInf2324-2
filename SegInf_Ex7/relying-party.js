const express = require('express')
const cookieParser = require('cookie-parser');
const axios = require('axios');
const FormData = require('form-data');// more info at:
// https://github.com/auth0/node-jsonwebtoken
// https://jwt.io/#libraries
const jwt = require('jsonwebtoken');
const { newEnforcer } = require('casbin')
const { Octokit } = require('@octokit/core');

// já temos milestones criadas, fazer redirect para oauth no github, e obter as milestones, depois clicar numa milestone e criar como uma google task

const GITHUB_CLIENT_ID = "c9ba4c33fd449924e2fa"
const GITHUB_CLIENT_SECRET = "a4c3dc682b9296eed9c3397cd29927929622f21b"

const port = 3001

// system variables where Client credentials are stored
const CLIENT_ID = "213703955375-gpurfk3fhaenf1r572qg8prlfd7ptff9.apps.googleusercontent.com"
const CLIENT_SECRET = "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"
// callback URL configured during Client registration in OIDC provider
const CALLBACK = 'callback-demo2324'

const app = express()
app.use(cookieParser());

app.get('/', (req, resp) => {
    resp.send('<a href=/login>Use Google Account</a>')
})

const pdp = async function(s, o, a, res) {
    const enforcer = await newEnforcer('model.conf', 'policy.csv')
    let r = await enforcer.enforce(s, o, a);
    return {res: r, sub: s, obj: o, act: a}
}

// More information at:
//      https://developers.google.com/identity/protocols/OpenIDConnect

app.get('/login', (req, resp) => {
    resp.redirect(302,
        // authorization endpoint
        'https://accounts.google.com/o/oauth2/v2/auth?'
        
        // client id
        + 'client_id='+ CLIENT_ID +'&'
        
        // OpenID scope "openid email"
        + 'scope=openid%20email&'
        
        // parameter state is used to check if the user-agent requesting login is the same making the request to the callback URL
        // more info at https://www.rfc-editor.org/rfc/rfc6749#section-10.12
        + 'state=value-based-on-user-session&'
        
        // responde_type for "authorization code grant"
        + 'response_type=code&'
        
        // redirect uri used to register RP
        + 'redirect_uri=http://localhost:3001/'+CALLBACK)
})

app.get("/github", (req, res) => {
    /*const form = new FormData()
    form.append("client_id", GITHUB_CLIENT_ID)
    form.append("redirect_uri", "http://localhost:3001/callback-2324")
    form.append("scope", "user")
    form.append("state", "seginf")*/

    res.redirect(302, "https://github.com/login/oauth/authorize?"
                + "client_id=" + GITHUB_CLIENT_ID + "&"
                + "redirect_uri=" + "http://localhost:3001/callback-2324&"
                + "scope=user&" //TODO(): MUDAR O SCOPE DE USER PARA REPO?
                + "state=seginf")
})

app.get("/callback-2324", async (req, res) => {
    const githubCode = req.query.code;
    
    // Create FormData with required parameters
    const form = new FormData();
    form.append("client_id", GITHUB_CLIENT_ID);
    form.append("client_secret", GITHUB_CLIENT_SECRET);
    form.append("code", githubCode);
    form.append("redirect_uri", "http://localhost:3001/callback-2324");

    // Make a POST request to GitHub token endpoint
    try {
        const response = await axios.post("https://github.com/login/oauth/access_token", form, {
            headers: {
                ...form.getHeaders()
            }
        });

        // Save the GitHub token in a cookie or handle it as needed
        res.cookie("Github_Token", response.data.access_token);

        const urlSearchParams = new URLSearchParams(response.data);
        const accessToken = urlSearchParams.get('access_token');
        console.log(accessToken)

        const owner = "47186JoaoSilva"; // Replace with the actual owner (username) of the repository
        const repo = "SegInfTest"; // Replace with the actual name of the repository

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/milestones`;

        const octokit = new Octokit({
            auth: `Bearer ${accessToken}`,
            userAgent: 'YourApp/1.0.0', // Replace with your app's name and version
            baseUrl: 'https://api.github.com',
            request: {
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        });

        const { data: projects } = await octokit.request('GET /repos/{owner}/{repo}/projects', {
            owner,
            repo
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/callback-demo2324', (req, resp) => {
    //
    // TODO: check if 'state' is correct for this session
    //

    console.log('making request to token endpoint');
    // content-type: application/x-www-form-urlencoded (URL-Encoded Forms)
    const form = new FormData();
    form.append('code', req.query.code);
    form.append('client_id', CLIENT_ID);
    form.append('client_secret', CLIENT_SECRET);
    form.append('redirect_uri', 'http://localhost:3001/callback-demo2324');
    form.append('grant_type', 'authorization_code');
    //console.log(form);

    axios.post(
        // token endpoint
        'https://www.googleapis.com/oauth2/v3/token', 
        // body parameters in form url encoded
        form,
        { headers: form.getHeaders() }
    )
    .then(function (response) {
        // AXIOS assumes by default that response type is JSON: https://github.com/axios/axios#request-config
        // Property response.data should have the JSON response according to schema described here: https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse

        console.log(response.data);
        // decode id_token from base64 encoding
        // note: method decode does not verify signature
        var jwt_payload = jwt.decode(response.data.id_token);
        console.log(jwt_payload);

        // a simple cookie example
        resp.cookie("user_email", jwt_payload.email);
        // HTML response with the code and access token received from the authorization server
        resp.send(
            '<div> callback with code = <code>' + req.query.code + '</code></div><br>' +
            '<div> client app received access code = <code>' + response.data.access_token + '</code></div><br>' +
            '<div> id_token = <code>' + response.data.id_token + '</code></div><br>' +
            '<div> Hi <b>' + jwt_payload.email + '</b> </div>' +
            // Add a button that triggers the /github route
            '<form action="/github" method="get">' +
            '   <button type="submit">Authenticate with GitHub</button>' +
            '</form>' +
            'Go back to <a href="/">Home screen</a>'
        );
    })
    .catch(function (error) {
        console.log(error);
        resp.send();
    });
});

app.get("/tasks", (req, res) => {
    console.log("Entered function")
    pdp("moreiram2009@gmail.com", "tasks", "read").then(decision => {
        console.log(decision)
        if (!decision.res) {
            res.send(
                '<div><b>Not Authorized 401</b></div>'
            )
        } else {
            res.send(
                '<div><b>Congrats you are authorized</b></div>'
            )
        }
    })
})

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${port}`)
})
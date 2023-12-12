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
        + 'scope=https://www.googleapis.com/auth/tasks%20openid%20email&'
        
        // parameter state is used to check if the user-agent requesting login is the same making the request to the callback URL
        // more info at https://www.rfc-editor.org/rfc/rfc6749#section-10.12
        + 'state=value-based-on-user-session&'
        
        // responde_type for "authorization code grant"
        + 'response_type=code&'
        
        // redirect uri used to register RP
        + 'redirect_uri=http://localhost:3001/'+CALLBACK)
})

app.get("/github", (req, res) => {
    res.redirect(302, "https://github.com/login/oauth/authorize?"
                + "client_id=" + GITHUB_CLIENT_ID + "&"
                + "redirect_uri=" + "http://localhost:3001/callback-2324&"
                + "scope=user repo&" 
                + "state=seginf")
})

app.get("/callback-2324", (req, res) => {
    const githubCode = req.query.code;

    const data = new URLSearchParams();
    data.append("client_id", GITHUB_CLIENT_ID);
    data.append("client_secret", GITHUB_CLIENT_SECRET);
    data.append("code", githubCode);
    data.append("redirect_uri", "http://localhost:3001/callback-2324");

    
    axios.post("https://github.com/login/oauth/access_token", data, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    }).then(response => {
        // Check if the request was successful
        if (response.data.access_token) {
          // Access token obtained
          const accessToken = response.data.access_token;
          res.cookie("Github_Token", accessToken);

          res.redirect("/github/repo-scope");
        } else {
          // Handle error
          console.error("Error:", response.data.error_description || "Unknown error");
        }
      })
      .catch(error => {
        // Handle network error or other issues
        console.error("Error:", error.message || "Network error");
      });
});

app.get("/github/repo-scope", async (req, res) => {
    const accessToken = req.cookies.Github_Token;
    const googleAccessToken = req.cookies.google_access_token;

    const owner = "47186JoaoSilva"; 
    const repo = "SegInfTest"; 

    const octokit = new Octokit({
        auth: `Bearer ${accessToken}`,
        request: {
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        }
    });

    try {
        const { data: milestones } = await octokit.request('GET /repos/{owner}/{repo}/milestones', {
            owner,
            repo
        });

        let html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Milestones</title></head><body><h1>Milestones</h1>';

        milestones.forEach(milestone => {
            html += `<div>
                        <p><strong>Title:</strong> ${milestone.title}</p>
                        <p><strong>Description:</strong> ${milestone.description}</p>
                        <button onclick="createTask('${milestone.id}','${milestone.title}', '${googleAccessToken}')">Create Task</button>
                        <hr>
                    </div>`;
        });

        html += createTaskFunction;;

        html += '</body></html>';
        res.send(html);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

function createTask(milestoneId) {
    fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
        },
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
        const taskDetails = {
            title: 'Test1',
            notes: ' ',
            due: '2023-12-31T23:59:59Z',
        };

        const apiUrl = `https://tasks.googleapis.com/tasks/v1/lists/${data.items[0].id}/tasks`;
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskDetails),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Task created:', data);
        })
        .catch(error => {
            console.error('Error creating task:', error);
        });
    })
    .catch(error => {
        console.error('Error retrieving task lists:', error);
    });
}

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
        resp.cookie("google_access_token", response.data.access_token);
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

// Define the createTask function
const createTaskFunction = `
<script>
    function createTask(milestoneId, milestoneTitle, googleAccessToken) {
        console.log(googleAccessToken);
        fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + googleAccessToken,
            },
        })
        .then(response => response.json())
        .then(data => {
            const taskDetails = {
                title: milestoneTitle,
                notes: ' ',
                due: '2023-12-31T23:59:59Z',
            };
            console.log(data.items.id)
            const apiUrl = 'https://tasks.googleapis.com/tasks/v1/lists/' + data.items[0].id + '/tasks';
            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + googleAccessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskDetails),
            })
            .then(response => response.json())
            .then(data => {
                console.log('Task created:', data);
            })
            .catch(error => {
                console.error('Error creating task:', error);
            });
        })
        .catch(error => {
            console.error('Error retrieving task lists:', error);
        });
    }
</script>
`;


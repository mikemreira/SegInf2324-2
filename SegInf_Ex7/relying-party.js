const express = require('express')
const cookieParser = require('cookie-parser');
const axios = require('axios');
const FormData = require('form-data');
const jwt = require('jsonwebtoken');
const { newEnforcer } = require('casbin')
const { Octokit } = require('@octokit/core');
const fetch = require('node-fetch')

const permissions = [
    ["moreiram2009@gmail.com", "admin"],
    ["tugaviegas@gmail.com", "premium"],
    ["jonhykiko2001@hotmail.com", "free"]
]

const GITHUB_CLIENT_ID = "c9ba4c33fd449924e2fa"
const GITHUB_CLIENT_SECRET = "a4c3dc682b9296eed9c3397cd29927929622f21b"

let GITHUB_ACCESS_TOKEN = ""
let GOOGLE_ACCESS_TOKEN = ""

const port = 3001

const CLIENT_ID = "213703955375-gpurfk3fhaenf1r572qg8prlfd7ptff9.apps.googleusercontent.com"
const CLIENT_SECRET = "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"
const CALLBACK = 'callback-demo2324'

const app = express()
app.use(cookieParser());

app.get('/', (req, resp) => {
    resp.send('<a href=/login>Use Google Account</a>')
})

const pdp = async function(s, o, a) {
    const enforcer = await newEnforcer('model.conf', 'policy.csv')
    let r = await enforcer.enforce(s, o, a);
    return {res: r, sub: s, obj: o, act: a}
}

app.get('/login', (req, resp) => {
    resp.redirect(302,
        'https://accounts.google.com/o/oauth2/v2/auth?'
        + 'client_id='+ CLIENT_ID +'&'  
        + 'scope=https://www.googleapis.com/auth/tasks%20openid%20email&'
        + 'state=value-based-on-user-session&'
        + 'response_type=code&'
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
        if (response.data.access_token) {
          // Access token obtained
          const accessToken = response.data.access_token;
          GITHUB_ACCESS_TOKEN = accessToken

          res.redirect("/github/repo-scope");
        } else {
          console.error("Error:", response.data.error_description || "Unknown error");
        }
      })
      .catch(error => {
        console.error("Error:", error.message || "Network error");
      });
});

app.get("/github/repo-scope", (req, res) => {
    res.send(
        '<form action="/github-milestones" method="get">' +
        '<label for="username">GitHub Owner:</label>' + 
        '<input type="text" id="owner" name="owner" required>' +
        '<label for="repository">Repository Name:</label>' +
        '<input type="text" id="repository" name="repository" required>' +
        '<button type="submit">Get Repository Info</button>' +
        '</form'
    )
});

app.get("/github-milestones", async (req, res) => {
    const accessToken = GITHUB_ACCESS_TOKEN;
    const googleAccessToken = GOOGLE_ACCESS_TOKEN;

    const { owner, repository } = req.query

    const octokit = new Octokit({
        auth: `Bearer ${accessToken}`,
        request: {
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            },
            fetch: fetch
        }
    });

    try {
        const { data: milestones } = await octokit.request('GET /repos/{owner}/{repository}/milestones', {
            owner,
            repository
        });

        let html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Milestones</title></head><body><h1>Milestones</h1>';

        milestones.forEach(milestone => {
            html += `<div>
                        <p><strong>Title:</strong> ${milestone.title}</p>
                        <p><strong>Description:</strong> ${milestone.description}</p>
                        <form action="/createTask/${milestone.id}/${milestone.title}" method="POST"><button type="submit">Create Task</button></form>
                        <hr>
                    </div>`;
        });

        html += '</body></html>';
        res.send(html);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
})

app.post('/createTask/:id/:title', (req, res) => {
    console.log(req.cookies["user_email"])
    const p = permissions.find(it => (it[0] == req.cookies["user_email"]))[1]
    console.log(p)
    pdp(p, "tasks", "write").then(decision => {
        if (decision.res == true) {
            createTask(req.params.id, req.params.title, GOOGLE_ACCESS_TOKEN)
            res.send(
                '<h1>Task Created</h1>' + 
                '<a href="/github/repo-scope">Return to milestones</a>'
            )
        } else {
            res.send('<div>UNAUTHORIZED</div>')
        }
    })
})


app.get('/callback-demo2324', (req, resp) => {
    const form = new FormData();
    form.append('code', req.query.code);
    form.append('client_id', CLIENT_ID);
    form.append('client_secret', CLIENT_SECRET);
    form.append('redirect_uri', 'http://localhost:3001/callback-demo2324');
    form.append('grant_type', 'authorization_code');

    axios.post(
        'https://www.googleapis.com/oauth2/v3/token', 
        form,
        { headers: form.getHeaders() }
    )
    .then(function (response) {
        var jwt_payload = jwt.decode(response.data.id_token);
        console.log(jwt_payload);

        resp.cookie("user_email", jwt_payload.email);
        resp.cookie("id_token", response.data.id_token);

        GOOGLE_ACCESS_TOKEN = response.data.access_token
        resp.send(
            '<div> callback with code = <code>' + req.query.code + '</code></div><br>' +
            '<div> client app received access code = <code>' + response.data.access_token + '</code></div><br>' +
            '<div> id_token = <code>' + response.data.id_token + '</code></div><br>' +
            '<div> Hi <b>' + jwt_payload.email + '</b> </div>' +
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

function createTask(milestoneId, milestoneTitle, googleAccessToken) {
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

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${port}`)
})

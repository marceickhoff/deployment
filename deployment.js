const http = require("http");
const crypto = require("crypto");
const childProcess = require("child_process");
const fs = require("fs");

const repos = JSON.parse(fs.readFileSync("repos.json").toString());
const port = 1111;

http.createServer((req, res) => {

    // Error handling
    res.on("error", (err) => {
        console.error(err);
    });

    // Request data
    const {headers, method, url} = req;
    const event = headers["x-github-event"];
    let chunks = [];

    // Prepare response body
    res.body = {
        success: false,
        message: null
    };

    // Get data from request
    req.on("data", chunk => {
        chunks.push(chunk);
    });

    // Process data
    req.on("end", () => {

        // Prepare response header
        res.setHeader("Content-Type", "application/json");

        // Check request method
        if (method !== "POST") {
            res.body.message = "Unsupported request method!";
            res.statusCode = 405;
            res.statusMessage = "Method Not Allowed";
            return;
        }

        // Parse request body
        chunks = Buffer.concat(chunks);
        const body = JSON.parse(chunks.toString());

        // Repository that was pushed
        const repoName = body.repository.full_name;

        // Get repository from config
        const repo = repos[repoName];
        if (typeof repo === "undefined") {
            res.body.message = `No deployment configured for ${repoName}`;
            res.statusCode = 404;
            res.statusMessage = "Not Found";
            return;
        }

        // Create and verify signature for request body
        const signature = `sha1=${crypto.createHmac("sha1", repo.secret).update(chunks).digest("hex")}`;
        if (headers["x-hub-signature"] !== signature) {
            res.body.message = "Signature mismatch";
            res.statusCode = 403;
            res.statusMessage = "Forbidden";
            return;
        }

        // Branch that was pushed
        const branchName = body.ref.split("/").slice(-1)[0];

        // Get branch
        const branch = repo.branches[branchName];
        if (typeof branch === "undefined") {
            res.body.message = `No deployment configured for branch ${branchName} of repository ${repoName}`;
            res.statusCode = 404;
            res.statusMessage = "Not Found";
            return;
        }

        // Handle ping event
        if (event === "ping") {
            res.body.message = "Ping event received";
            res.body.success = true;
            res.statusCode = 200;
            res.statusMessage = "OK";
            return;
        }

        // Handle push event
        else if (event === "push") {
            res.body.message = "Push event received, starting deployment process";
            res.statusCode = 202;
            res.statusMessage = "Accepted";
            res.body.success = true;

            // List of commands to run
            let commands = [];

            // Commands to run before deployment
            if (Array.isArray(branch.commands.before)) {
                commands = commands.concat(branch.commands.before);
            }

            // Commands for actual deployment
            commands = commands.concat([
                `git fetch --all`,
                `git checkout ${branchName}`,
                `git reset --hard origin/${branchName}`,
                `git pull`,
            ]);

            // Commands to run after deployment
            if (Array.isArray(branch.commands.after)) {
                commands = commands.concat(branch.commands.after);
            }

            // Execute commands in child process
            console.log(`Deploying ${branchName} of repository ${repoName}...`);
            let process = childProcess.exec(commands.join(" && "), {cwd: branch.target});
            process.stdout.on('data', function (data) {
                console.log(data.toString());
            });
        }

        // Handle unsupported event
        else {
            res.body.message = `Unsupported event "${event}"`;
            res.statusCode = 400;
            res.statusMessage = "Bad Request";
            return;
        }

        // End transaction, send response
        res.end(JSON.stringify(res.body));
    });
})
.listen(port, function () {
    console.log(`Listening on port ${port}...`);
});
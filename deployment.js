const http = require("http");
const crypto = require("crypto");
const childProcess = require("child_process");
const fs = require("fs");

const repos = JSON.parse(fs.readFileSync("repos.json").toString());
const port = 1111;

http.createServer((req, res) => {

    req.on("data", chunk => {

        // Handle ping event
        if (req.headers["x-github-event"] === "ping") {
            console.log("Ping event recieved!");
            return;
        }

        // Check for GitHub event
        if (req.headers["x-github-event"] !== "push") {
            console.log("Unsupported event!");
            return;
        }

        // Parse request body
        const body = JSON.parse(chunk);

        // Repository that was pushed
        const repoName = body.repository.full_name;

        // Get repository from config
        const repo = repos[repoName];
        if (typeof repo === "undefined") {
            console.log(`No deployment configured for ${repoName}`);
            return;
        }

        // Branch that was pushed
        const branchName = body.ref.split("/").slice(-1)[0];

        // Get branch
        const branch = repo.branches[branchName];
        if (typeof branch === "undefined") {
            console.log(`No deployment configured for branch ${branchName} of repository ${repoName}`);
            return;
        }

        // Create and verify signature for request body
        const signature = `sha1=${crypto.createHmac("sha1", repo.secret).update(chunk).digest("hex")}`;
        if (req.headers["x-hub-signature"] !== signature) {
            console.log("Signature mismatch");
            return;
        }

        // Move to deployment target directory
        let commands = [];
        if (Array.isArray(branch.commands.before)) {
            commands = commands.concat(branch.commands.before);
        }
        commands = commands.concat([
            `git fetch --all`,
            `git checkout ${branchName}`,
            `git reset --hard origin/${branchName}`,
            `git pull`,
        ]);
        if (Array.isArray(branch.commands.after)) {
            commands = commands.concat(branch.commands.after);
        }
        console.log(`Deploying ${branchName} of repository ${repoName}...`);
        let process = childProcess.exec(commands.join(" && "), {cwd: branch.target});
        process.stdout.on('data', function (data) {
            console.log(data.toString());
        });
    });
    res.end();
})
.listen(port, function () {
    console.log(`Listening on port ${port}...`);
});
# Node.js Deployment Script for GitHub Webhooks
![license](https://img.shields.io/github/license/marceickhoff/deployment)

This is a simple Node.js Script for automatic deployments using GitHub Webhooks.

## Installation

On your deployment server run:

```
git clone https://github.com/marceickhoff/deployment.git && npm i
```

## Configuration

First you need to create a Webhook for your repository (obviously). Set the payload URL to ``http://your-host-name.example:1111``, the content type to ``application/json`` and the events to just push (the script currently only supports push and ping anyways). Make sure to choose a secure secret and copy it.

Now on your server copy the ``repos.example.json`` file and rename it to ``repos.json``.

In this file you can configure the deployment processes for different repositories. Fill in your GitHub username, repository name, branch(es) to watch, target directory, and the commands to run before and/or after the pull.

## Usage

```
npm run start
```

This will use [forever](https://www.npmjs.com/package/forever) to start a simple HTTP server script that listens for Webhook events.

The script will now run the commands you specified in the ``repos.json`` every time you push to the specified branch(es).

You can use ``npm run stop`` to stop the script.

I recommend using ``screen`` to keep the script running when you exit the terminal.
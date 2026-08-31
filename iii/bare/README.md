# bare: a minimal compose project

The smallest iii project. A small `worker-compose.yaml` that starts the
web console.

There's a lot of functionality you can bring up in iii by uncommenting
the relevant workers in `worker-compose.yaml`. Plus many more workers on
https://workers.iii.dev for you to try. Keep that in mind as you explore.

If you'd like to start with agentic development instead you can create
a new project with:

```bash
iii project init -t harness my_project
```

That will give you a project prebuilt for agentic development.

## Start the compose worker and bring the iii engine up in one command

In a new terminal from the project directory run:

```bash
iii compose --up
```

## Start compose step by step

Compose can also be started independently like any other iii worker. This is what you
would run if you started the engine and `iii compose` without the `--up` flag.

In the first terminal, start the engine:

```bash
iii
```

In a second terminal, serve the compose daemon:

```bash
iii compose
```

In a third terminal, bring the project up:

```bash
iii trigger compose::up
```

## Use the console

Once the project is started you should see output from the `iii compose` daemon
like:

```bash
engine started
  pid: 68448
  owner: /path/to/worker-compose.yaml
  config: /path/to/engine-config.yaml
  logs: /path/to/engine.log
  follow logs: tail -f '/path/to/engine.log'

compose serving
  engine: ws://127.0.0.1:49134
  namespace: default

[compose] project /path/to/worker-compose.yaml loaded into default
✓ console ready (1.1s)
up: 1 of 1 changed in 1.1s
```

Once you see that output open the console at **http://127.0.0.1:3113**.

## Add more workers

`worker-compose.yaml` has a ready-to-uncomment block for `state`, `queue`,
`cron`, `database`, `http`, and the full agent harness. Uncomment the block you
want and restart compose.

Visit https://workers.iii.dev/ to see the constantly updating fleet of workers
we have available.

Check out https://iii.dev/docs/using-iii/compose for more on making use of compose
to build out your project.

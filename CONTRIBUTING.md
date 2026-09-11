# Template validation

For team development and validation, export the telemetry opt-out in every
shell **before** running the installer or any `iii` / `iii-worker` command,
including `--version`, project initialization, and `iii compose --up`:

```bash
export III_TELEMETRY_ENABLED=false
iii --version
scripts/smoke-init.sh
```

The Init Smoke workflow, smoke script, and VHS recording set this explicitly.
The smoke suite requires `iii`, Python 3, and Docker Compose with
`config --no-env-resolution`; environment rendering does not need a Docker daemon.

Containers need the variable in their own runtime environment. The public
Docker Compose templates forward `${III_TELEMETRY_ENABLED:-true}`, so the
export above also opts out when running `docker compose up --build`. For a
direct Docker invocation, pass `docker run -e III_TELEMETRY_ENABLED=false ...`.
An `.env` file used by a container does not opt out the host CLI; export the
variable before starting that CLI too. Restart existing host processes or
recreate existing containers after changing their environment.

Public templates retain default telemetry when the variable is unset or empty.
Keep the team opt-out in validation environments; do not bake it into production
Dockerfiles or ship a permanent `false` in customer templates.

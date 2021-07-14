## Archive Schoology courses

This requires Deno. [It's pretty easy to
install.](https://deno.land/manual@v1.11.0/getting_started/installation#download-and-install)

Go to [Schoology](https://pausd.schoology.com/home) and right click > Inspect >
Application > Cookies > https://pausd.schoology.com >
SESS61db7d00d28d332758e01dd6ef4e88e9. The cookie value allows the script to
fetch Schoology on behalf of you. You are right to be sceptical of this.

Store the cookie in a `.env` file, following the format of `.env.example`.

```sh
echo "SESS=<cookie value here>"
```

Then, run

```sh
# Get courses
deno run \
  --allow-read=cache,output,.env,.env.example,.env.defaults \
  --allow-write=cache,output \
  --allow-net=pausd.schoology.com \
  --allow-env \
  https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/courses.ts

# Get messages
deno run \
  --allow-read=cache,output,.env,.env.example,.env.defaults \
  --allow-write=cache,output \
  --allow-net=pausd.schoology.com \
  --allow-env \
  https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/messages.ts
```

Deno is secure by default, so I've explicitly listed its permissions here. It
can only read and write to the listed directories and make network requests to
the listed domain. It can also access and modify your environment variables.

### WSL quirk

You might get a 401 HTTP error for multi-get:

> Timestamp is out of bounds (3600 seconds before or after current time). Given
> timestamp is 1626263098, current timestamp is 1626293166.

This is because Windows Subsystem for Linux (WSL)'s time can get desynched from
the computer time. See [Time not synced in WSL2 - causing TLS
issues](https://github.com/microsoft/WSL/issues/4149).

There are two solutions. Either [update the time
manually](https://github.com/microsoft/WSL/issues/4149#issuecomment-521877012)
or [restart
WSL](https://github.com/microsoft/WSL/issues/4149#issuecomment-502446496).

```sh
sudo apt install ntpdate
sudo ntpdate -sb time.nist.gov
```

```sh
wsl --shutdown
```

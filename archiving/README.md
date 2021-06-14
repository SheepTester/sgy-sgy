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
deno run \
  --allow-read=cache,output,.env,.env.example,.env.defaults \
  --allow-write=cache,output \
  --allow-net=pausd.schoology.com \
  --allow-env \
  https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/courses.ts
```

Deno is secure by default, so I've explicitly listed its permissions here. It
can only read and write to the listed directories and make network requests to
the listed domain. It can also access and modify your environment variables.

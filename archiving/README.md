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
  <SCRIPT URL>
```

Here's a list of `<SCRIPT URL>`s you can use.

| `<SCRIPT URL>`                                                                         | Description                                                                                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/courses.ts      | Get all your course materials.                                                                                     |
| https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/messages.ts     | Get Schoology messages.                                                                                            |
| https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/user.ts         | Get your user profile, updates, and blogs. You can also provide a list of Schoology user IDs to fetch other users. |
| https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/resources.ts    | Get all personal and group resources.                                                                              |
| https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/groups.ts       | Get all groups available in the district as well as the updates of the groups you're in.                           |
| https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/portfolios.ts   | Get your portfolios.                                                                                               |
| https://raw.githubusercontent.com/SheepTester/sgy-sgy/master/archiving/get-students.ts | Compile a bunch of user profiles together given a students.json (meant for personal use).                          |

Deno is secure by default, so I've explicitly listed its permissions here. It
can only read and write to the listed directories (`cache` for caching Schoology
requests, and `output` where resulting archive is stored) and make network
requests to the listed domain (https://pausd.schoology.com/). It can also access
and modify your environment variables to get the Schoology session cookie.

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

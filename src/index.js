/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
// var url = require("url");
import { Buffer } from "node:buffer";
import { WebSocketHibernationServer } from './WebSocketHibernationServer.js';
export { WebSocketHibernationServer };

const mEncoder = new TextEncoder();
function timingSafeEqual(a, b) {
	const aBytes = mEncoder.encode(a);
	const bBytes = mEncoder.encode(b);

	if (aBytes.byteLength !== bBytes.byteLength) {
		// Strings must be the same length in order to compare
		// with crypto.subtle.timingSafeEqual
		return false;
	}

	return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

globalThis.Buffer = Buffer;
import xml2js from "xml2js";

async function getCbrRates(date) {
	//	const url = 'http://www.cbr.ru/scripts/XML_daily.asp?date_req=08/12/2025'; // Пример с конкретной датой
	const url = `http://www.cbr.ru/scripts/XML_daily.asp?date_req=${date}`; // Пример с конкретной датой

	// console.log(url)

	try {
		const response = await fetch(url);
		const arr = await response.arrayBuffer();
		const txt = (new TextDecoder('windows-1251').decode(arr))
		return txt
		//const xmlText = await response.text();
		//return xmlText;
	} catch (error) {
		console.error("Ошибка при загрузке XML:", error);
		return "Hello!";
	}
}

//const b64str =
//	"AAABAAEAEBAQAAEABAAoAQAAFgAAACgAAAAQAAAAIAAAAAEABAAAAAAAgAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAA/4QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQABAREAEREBAAEBARAQAREREBEAEBEAEBAQEAAQEQEQEBAQABAQAQAREBAAEBABAAEQEAAQEAEAAQAQABAREQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAA//8AAP//AAB//wAAdGEAAHUsAAAJpgAAq6QAAKutAACLrQAAy60AANuhAAD//wAA//8AAP//AAD//wAA"

function formatDateDDMMYYYY(date) {
	const d = date ? (date instanceof Date ? date : new Date(date)) : new Date();

	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0"); // months are 0-based
	const year = d.getFullYear();

	return `${day}/${month}/${year}`;
}

function escapeHtml(str = "") {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
export default {

	async fetch(request, env, ctx) {

		const { cf } = request || {};
		const { country, city, region, regionCode, timezone, longitude, latitude, postalCode, continent } = cf || {};

		let myDate = new Date().toLocaleString('en-US', {
			timeZone: 'Europe/Moscow'
		});;
		const url = new URL(request.url);
		//const { searchParams } = new URL(request.url)
		const dateReq = url.searchParams.get('date_req')

		//console.log(url.pathname + '   ' + dateReq)
		const dateMatchReq = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dateReq)
		if (dateMatchReq) {
			myDate = new Date(`${dateMatchReq[2]}/${dateMatchReq[1]}/${dateMatchReq[3]}`).toLocaleString('en-US', {
				timeZone: 'Europe/Moscow'
			});
			//	console.log(`${dateMatchReq[2]}/${dateMatchReq[1]}/${dateMatchReq[3]}` + ' ' + myDate);
			//		}
			//console.log('myDate: ' + myDate + ' ' + myDate.timeZone);

			//////////////////// /favicon.ico /////////////////////////
			//		if (url.pathname == "/favicon.ico") {
			//			const buf = Buffer.from(b64str, 'base64')
			//			return new Response(
			//				buf,
			//				{
			//					status: 200,
			//					headers: {
			//						"Content-Length": buf.length,
			//						"Content-Type": "image/x-icon"
			//					}
			//				}
			//			)
			/////////////////////////////////////////////////////////////
		}
		const xmlCbrRatesString = await getCbrRates(formatDateDDMMYYYY(myDate))
		let jsn

		//////////////////////// /api/v01/cbrf/xml //////////////////            
		if (url.pathname == "/api/v01/cbrf/xml") {
			return new Response(xmlCbrRatesString, {
				headers: {
					"Content-Type": "application/xml; charset=UTF-8"
				}
			});

			/////////////////////////////// /api/v01/cbrf/json //////////
		} else if (url.pathname == "/api/v01/cbrf/json") {
			xml2js.parseString(xmlCbrRatesString, { explicitArray: false, mergeAttrs: true }, (err, result) => {
				if (err) throw err;
				jsn = JSON.stringify(result, null, 8);
			});
			return new Response(jsn, {
				headers: {
					"Content-Type": "application/json; charset=UTF-8"
				}
			});

		} else if (url.pathname == "/api/v01/ipgeo/json") {
			return new Response(
				JSON.stringify(
					{
						continent,
						country,
						region,
						region_code: regionCode,
						city,
						longitude,
						latitude,
						postal_code: postalCode,
						cf_connecting_ip: request.headers.get('cf-connecting-ip'),
						timezone,
					},
					null, 8,
				),
				{
					headers: {
						"Content-Type": "application/json; charset=UTF-8"
					}
				},
			);
			/////////////////////////// /api/v01/chat/uuidgen 	
		} else if (url.pathname == "/api/v01/chat/uuidgen") {
			if (request.method == "POST") {
				let id = env.WEBSOCKET_HIBERNATION_SERVER.newUniqueId();
				return new Response(id.toString(), { headers: { "Access-Control-Allow-Origin": "*" } });
			} else {
				return new Response("Method not allowed", {status: 405});
			}
			/////////////////////////////// /index.html //////////////////
		} else if (url.pathname == "/index.html") {

			console.log(`country: ${country}, city: ${city}, cf-connecting-ip: ${request.headers.get('cf-connecting-ip')}`)
			let items;
			let myCaption;
			xml2js.parseString(xmlCbrRatesString, { explicitArray: false, mergeAttrs: true }, (err, result) => {
				if (err) throw err;
				myCaption = `${result.ValCurs.Date} ${result.ValCurs.name}`
				items = Array.isArray(result.ValCurs.Valute) ? result.ValCurs.Valute : [result.ValCurs.Valute]
			});
			const headers = ["ID", "NumCode", "CharCode", "Nominal", "Name", "Value", "VunitRate"];
			const rowsHtml = items
				.map(v => {
					const cells = headers
						.map(h => `<td>${escapeHtml(v[h])}</td>`)
						.join("");
					if (v['CharCode'] == 'USD') {
						return `<tr style="background: #040;">${cells}</tr>`;
					} else {
						return `<tr>${cells}</tr>`;
					}
				})
				.join("");

			const tableHtml = `
<table>
  <caption>${myCaption}</caption>
  <thead>
    <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>
`;

			return new Response(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seva BBS</title>
<style>
html { color-scheme: dark; }
body {
  display: flex;
  flex-direction: column;			
}
table {
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 2em;
}
table th { background-color: #555 }
table td, th {
  padding: .4em;
}
table tr:nth-child(even) {
  background-color: #333; /* dark gray */  
}
#startDate {
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 1em;
  margin-top: 1em;
  width: auto;
}
</style>
</head>
<body>
    <input type="date" id="startDate" value="2017-06-01" />
${tableHtml}
<script>
        //const dateControl = document.querySelector('input[type="date"]');
		const dateControl = document.getElementById('startDate');
        const urlParams = new URLSearchParams(window.location.search);
        var date_req = urlParams.get('date_req');
        var d;
        if (date_req) {
            var s = date_req.split('/');
            d = new Date(s[2], s[1] - 1, s[0]);
            dateControl.value = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
        } else {
            d = new Date();
            dateControl.value = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`; // "2017-06-01";
        }

		startDate.addEventListener('change', (e) => {
            let startDateVal = e.target.value
            // document.getElementById('startDateSelected').innerText = startDateVal
            const startDateValSplited = startDateVal.split("-")
            const startDateValNewFormat = \`\${startDateValSplited[2]}/\${startDateValSplited[1]}/\${startDateValSplited[0]}\`
            console.log(startDateValNewFormat)
            window.location.href = \`index.html?date_req=\${startDateValNewFormat}\`;
            //document.getElementsByTagName("table")[0].tBodies[0].innerHTML=''

        })

</script>
</body>
</html>
`,
				{
					headers: {
						"Content-Type": "text/html; charset=UTF-8"
					}
				},
			);



			// JSON string
			//jsn = JSON.stringify(result, null, 8);
			//fs.writeFileSync("output.json", json);

			/////////////////////////////// /bbs/logout //////////////////
		} else if (url.pathname == "/bbs/logout") {
			return new Response(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seva BBS</title>
<style>
html { color-scheme: dark; }
body {
  display: flex;
  flex-direction: column;			
}
</style>
</head>
<body>
	<h1>You are logged OUT!</h1>
	
	<a href="home">login</a>
</body>
</html>
`
				, {
					status: 401,
					headers: {
						"Cache-Control": "no-store",
						"Content-Type": "text/html; charset=UTF-8",
					},
				},
			);
			/////////////////////////// /bbs/chat   //////////////////
		} else if (url.pathname == "/bbs/chat") {
			const r = await checkBasicAuth(request, env)
			if (r instanceof Response) {
				return r;
			}
			const r1 = await env.bbs_d1_db.prepare("SELECT chatname FROM Chats").all();

			const chatList = (r1?.success && Array.isArray(r1.results)) ?
				`<div class="chatlist"><ol>

${r1.results?.map(row => `        <li><a href="#${row.ChatName.replaceAll(" ", "%20")}"  onclick="location.hash='#${row.ChatName.replaceAll(" ", "%20")}'; location.reload(); return false;">${row.ChatName}</a></li>\n`).join('')}
	  </ol></div>
`
				:
				'<h4>No chats yet</h4>'
				;
			const chatPage = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seva BBS</title>
<link rel="stylesheet" href="chat.css">
  </head>
  <body>
  	<h1>You at the CHAT page in BBS<br> as ${r}.</h1>
    <!-- <form id="name-form" action="/fake-form-action">
    //   <input id="name-input" placeholder="your name">
    //   <p>This chat runs entirely on the edge, powered by<br>
    //     <a href="https://blog.cloudflare.com/introducing-workers-durable-objects" target="_blank">Cloudflare Workers Durable Objects</a></p>
    // </form> -->
	<form id="chatroom" action="/fake-form-action">
      <div id="chatlog">
        <div id="spacer"></div>
      </div>
      <div id="roster"></div>
      <input id="chat-input">
    </form>
	<div class="selectchat" id="select-room">
	  ${chatList}
      <form id="room-form" action="/fake-form-action">
        <p>Enter a public room:</p>
        <input id="room-name" placeholder="room name"><button id="go-public">Go &raquo;</button>
        <p>OR</p>
        <button id="go-private">Create a Private Room &raquo;</button>
      </form>
	</div>
  	<script>window.username = "${r}" ;</script>
  	<script src="chat.js"></script>
  </body>
</html>  
			`;

			return new Response(
				chatPage
				// 				`<!DOCTYPE html>
				// <html>
				// <head>
				// <meta charset="UTF-8" />
				// <meta name="viewport" content="width=device-width, initial-scale=1">
				// <title>Seva BBS</title>
				// <style>
				// html { color-scheme: dark; }
				// body {
				//   display: flex;
				//   flex-direction: column;			
				// }
				// </style>
				// </head>
				// <body>
				// 	<h1>You at the CHAT page in BBS as ${r}.</h1>		
				// 	<a href="logout">logout</a>
				// </body>
				// </html>

				// `
				, {
					status: 200,
					headers: {
						"Cache-Control": "no-store",
						"Content-Type": "text/html; charset=UTF-8",
					},
				});
			/////////////////////////// /bbs/home   //////////////////
		} else if (url.pathname == "/bbs/home") {
			const r = await checkBasicAuth(request, env)
			if (r instanceof Response) {
				return r;
			}
			url.pathname = "/bbs/logout"
			url.username = "log"
			url.password = "out"
			return new Response(
				`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seva BBS</title>
<style>
html { color-scheme: dark; }
body {
  display: flex;
  flex-direction: column;			
}
</style>
</head>
<body>
	<h1>You are logged in BBS as ${r}.</h1>
	<p>🎉 You have private access!</p>
	<a href="chat">Chat</a>
	<a href="${url.toString()}">logout</a>
</body>
</html>

`
				, {
					status: 200,
					headers: {
						"Cache-Control": "no-store",
						"Content-Type": "text/html; charset=UTF-8",
					},
				});

		} else if (url.pathname == "/bbs/register") {
			if (request.method === "GET") {
				return new Response(
					`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seva BBS</title>
<style>
html { color-scheme: dark; }
body {
  display: flex;
  justify-content: center;
  flex-direction: column;	
  margin: 0;
  height: 100vh;	
}
.container {
  display: flex;
  flex-direction: column;
  max-width: 640px;
  margin: auto;
}
.btncontainer {
  display: flex;
  /* Distributes items along the main axis (horizontally by default) */
  justify-content: space-between; /* Puts equal space between items, pushes first/last to edges */
  /* OR use space-around; for equal space around each item (half-size space at ends) */
  /* OR use space-evenly; for completely equal space between, before, and after all items */
  /* OR use gap: 20px; to define a specific, consistent space between items */

  /* Optional: align items vertically in the container */
  align-items: center; 
}
</style>
</head>
<body>
<form action="register" method="post">
  <div class="container">
    <h1>Register</h1>
    <p>Please fill in this form to create an account.</p>
    <hr style="width: 100%;">

	<label for="loginname"><b>Login Name</b></label>
    <input type="text" placeholder="Enter Login Name" name="loginname" id="loginname" required>
	
    <label style="margin-top: 1em;" for="psw"><b>Password</b></label>
    <input type="password" placeholder="Enter Password" name="psw" id="psw" required>
	
    <label style="margin-top: 1em;" for="psw-repeat"><b>Repeat Password</b></label>
    <input type="password" placeholder="Repeat Password" name="psw-repeat" id="psw-repeat" required>

    <label style="margin-top: 1em;" for="email"><b>Email</b></label>
    <input type="text" placeholder="Enter Email" name="email" id="email">

    <hr style="width: 100%;">
    <p>By creating an account you agree to our <a href="#">Terms & Privacy</a>.</p>

	<div class="btncontainer">
		<button                                  type="reset" class="registerbtn">Reset Form</button>
    	<button style="background-color: green;" type="submit" class="registerbtn">Register</button>

	</div>
  </div>
  
  <div class="container signin">
    <p>Already have an account? <a href="home">Sign in</a>.</p>
  </div>
</form>
</body>
</html>

`
					, {
						status: 200,
						headers: {
							"Cache-Control": "no-store",
							"Content-Type": "text/html; charset=UTF-8",
						},
					});
			} else if (request.method === "POST") {
				try {
					const formData = await request.formData();

					// Access individual fields
					const name = formData.get("loginname");
					const psw = formData.get("psw");
					const psw_repeat = formData.get("psw-repeat");
					const email = formData.get("email");

					// You can now process this data (e.g., save to KV, send an email, etc.)
					// Example: logging the data to the console (for debugging/logs)
					console.log("Received form submission:", { name, email, psw, psw_repeat });

					if (psw != psw_repeat) {
						return new Response(`Error password not match repeat password.`, { status: 400 });
					}
					// TODO: Check user exist
					const insertSuccess = await env.bbs_d1_db
						.prepare("insert into Users (loginname, password, email) values (?, ?, ?)")
						.bind(name, psw, email)
						.run();

					console.log(insertSuccess);

					if (!insertSuccess?.success) {
						return new Response('Failed to insert data', { status: 500 });
					}

					// Respond to the client
					// return new Response("Thank you for your submission!", {
					// 	status: 200,
					// 	headers: {
					// 		"Content-Type": "text/plain"
					// 	}
					// });
					const url = new URL(request.url);
					url.pathname = "/bbs/home"
					return Response.redirect(url.toString(), 301);

				} catch (error) {
					return new Response(`Error processing form data: ${error.message}`, { status: 400 });
				}
			}

		} if (url.pathname == "/bbs/wschat") {

			const r = await checkBasicAuth(request, env)
			if (r instanceof Response) {
				return r;
			}
			// Expect to receive a WebSocket Upgrade request.
			// If there is one, accept the request and return a WebSocket Response.
			const upgradeHeader = request.headers.get("Upgrade");
			if (!upgradeHeader || upgradeHeader !== "websocket") {
				return new Response("Worker expected Upgrade: websocket", {
					status: 426,
				});
			}

			if (request.method !== "GET") {
				return new Response("Worker expected GET method", {
					status: 400,
				});
			}
			//const url = new URL(request.url);
			const chatName = url.searchParams.get('chatname');
			// TODO: check max chats number. check chat string to match [a-z][A-Z][0-9][ ]
			console.log(`*************** chatname: ${chatName}`)
			if (!chatName) {
				return new Response("No chat Name!", {
					status: 400,
				});
			}
			const chatInDb = await env.bbs_d1_db
				.prepare("SELECT * FROM Chats WHERE ChatName = ?")
				.bind(chatName)
				.first();

			if (!chatInDb) {
				const { cnt } = await env.bbs_d1_db
					.prepare("select count(*) as cnt from chats;")
					.first();
				console.log(`count = ${JSON.stringify(cnt)}, chat in db = ${JSON.stringify(chatInDb)}`);
				if (cnt > 12) {
					return new Response(`Too many chats already exits! (${cnt})`, {
						status: 400,
					});
				}
				const r = await env.bbs_d1_db
					.prepare("insert into Chats (chatName) values (?)")
					.bind(chatName)
					.run();
				console.log(`${JSON.stringify(r, null, 8)}`);
			}

			// Since we are hard coding the Durable Object ID by providing the constant name 'foo',
			// all requests to this Worker will be sent to the same Durable Object instance.
			let id = env.WEBSOCKET_HIBERNATION_SERVER.idFromName(chatName);
			let stub = env.WEBSOCKET_HIBERNATION_SERVER.get(id);

			return stub.fetch(request);
		}

		////////////////////////// any //////////////////////////
		return new Response(`${myDate}`)


	},
};

async function checkBasicAuth(request, env) {
	//	const BASIC_USER = "admin"
	//	const BASIC_PASS = "aaaaa"

	const authorization = request.headers.get("Authorization");
	if (!authorization) {
		console.log("no Authorization header")
		return new Response("You need to login.", {
			status: 401,
			headers: {
				// Prompts the user for credentials.
				"WWW-Authenticate": 'Basic realm="my scope", charset="UTF-8"',
			},
		});

	}
	const [scheme, encoded] = authorization.split(" ");

	// The Authorization header must start with Basic, followed by a space.
	if (!encoded || scheme !== "Basic") {
		return new Response("Malformed authorization header.", {
			status: 400,
		});
	}

	const credentials = Buffer.from(encoded, "base64").toString();

	// The username & password are split by the first colon.
	//=> example: "username:password"
	const index = credentials.indexOf(":");
	const user = credentials.substring(0, index);
	const pass = credentials.substring(index + 1);

	const u = await env.bbs_d1_db
		.prepare("SELECT * FROM Users WHERE LoginName = ?")
		.bind(user)
		.first();

	console.log(u ?? "eeeerrrrooorr");

	if (u?.LoginName == null) {
		return new Response(`No such user ${user}`, {
			status: 401,
			headers: {
				// Prompts the user for credentials.
				"WWW-Authenticate": 'Basic realm="my scope", charset="UTF-8"',
			},
		});
	}

	if (u?.Password != pass) {
		return new Response(`Wrong password ${pass}`, {
			status: 401,
			headers: {
				// Prompts the user for credentials.
				"WWW-Authenticate": 'Basic realm="my scope", charset="UTF-8"',
			},
		});
	}

	// if (
	// 	!timingSafeEqual(BASIC_USER, user) ||
	// 	!timingSafeEqual(BASIC_PASS, pass)
	// ) {
	// 	return new Response("You need to login.", {
	// 		status: 401,
	// 		headers: {
	// 			// Prompts the user for credentials.
	// 			"WWW-Authenticate": 'Basic realm="my scope", charset="UTF-8"',
	// 		},
	// 	});
	// }

	return user;
}
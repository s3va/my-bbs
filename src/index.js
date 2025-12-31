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
const b64str =
	"AAABAAEAEBAQAAEABAAoAQAAFgAAACgAAAAQAAAAIAAAAAEABAAAAAAAgAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAA/4QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQABAREAEREBAAEBARAQAREREBEAEBEAEBAQEAAQEQEQEBAQABAQAQAREBAAEBABAAEQEAAQEAEAAQAQABAREQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAA//8AAP//AAB//wAAdGEAAHUsAAAJpgAAq6QAAKutAACLrQAAy60AANuhAAD//wAA//8AAP//AAD//wAA"

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
		}
		//console.log('myDate: ' + myDate + ' ' + myDate.timeZone);

		//////////////////// /favicon.ico /////////////////////////
		if (url.pathname == "/favicon.ico") {
			const buf = Buffer.from(b64str, 'base64')
			return new Response(
				buf,
				{
					status: 200,
					headers: {
						"Content-Length": buf.length,
						"Content-Type": "image/x-icon"
					}
				}
			)
		/////////////////////////////////////////////////////////////
		} else {
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

			} else if (url.pathname == "/api/v01/ipgeo/json"){
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
				const headers = ["ID","NumCode", "CharCode", "Nominal", "Name", "Value", "VunitRate"];
				const rowsHtml = items
					.map(v => {
						const cells = headers
							.map(h => `<td>${escapeHtml(v[h])}</td>`)
							.join("");
						return `<tr>${cells}</tr>`;
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


			}

		////////////////////////// any //////////////////////////
			return new Response(`${myDate}`)

		}
	},
};



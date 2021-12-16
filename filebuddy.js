const http = require('http')
const fs = require('fs')
const path = require('path')
const indexTemplate = `
<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<html>
   <head>
      <meta charset="UTF-8">
   </head>
   <title>Filebuddy PATH</title>
   <body>
      <h2>PATH</h2>
      <hr>
      <form ENCTYPE="multipart/form-data" method="post"><input name="file" type="file"/><input type="submit" value="upload"/></form>
      <hr>
      <ul>
         <li><a href="UP">..</a></li>
         LISTE
      </ul>
      <hr>
   </body>
</html>
`
function getMimeType(name) {
    const mimes = {
        ".png": "image/png",
        ".gif": "image/gif",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".txt": "text/plain",
        ".js": "text/plain",
        ".py": "text/plain",
        ".html": "text/html"
    }
    return mimes[path.extname(name).toLowerCase()] || "application/octet-stream"
}
function printDirectory(res, directory) {
    const parent = path.dirname(directory)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    const dir = fs.readdirSync(directory).map(s => `<li><a href="${encodeURI(path.join("/", directory, s))}">${s}</a></li>`).join("\n")
    res.end(indexTemplate.replace("LISTE", dir).replace(/UP/g, encodeURI(path.join("/", parent))).replace(/PATH/g, directory))
}
http.createServer((req, res) => {
    const name = path.normalize(decodeURI(req.url).replace("/", ""))
    if (path.isAbsolute(name) || name.startsWith("..")) { // hello script kiddy
        res.statusCode = 404
        res.end()
        return
    }
    if (req.method === "POST") {
        const ct = req.headers['content-type']
        const boundary = "\r\n--" + ct.replace(/.*boundary=/, "")
        let writeStream = null
        let lastchunk = Buffer.from([], 0, 0)
        req.on('data', (chunk) => {
            if (!writeStream) {
                m = /.*filename=.([^'"]*)/.exec(chunk)
                const pos = chunk.indexOf("\r\n\r\n")
                if (m && pos >= 0) {
                    writeStream = fs.createWriteStream(path.join(name, path.basename(m[1])))
                    chunk = chunk.slice(pos + 4)
                }
            }
            if (writeStream) {
                const both = Buffer.concat([lastchunk, chunk])
                const endpos = both.indexOf(boundary)
                if (endpos >= 0) {
                    writeStream.end(both.slice(0, endpos))
                    writeStream = null
                } else {
                    writeStream.write(lastchunk)
                }
            }
            lastchunk = chunk
        })
        req.on('end', () => {
            if (writeStream) {
                writeStream.end()
            }
            printDirectory(res, name)
        })
    } else {
        const stat = fs.statSync(name, { throwIfNoEntry: false })
        if (stat && stat.isFile()) {
            res.writeHead(200, { 'Content-Type': getMimeType(name) })
            fs.createReadStream(name).pipe(res)
        } else if (stat && stat.isDirectory()) {
            printDirectory(res, name)
        } else {
            res.statusCode = 404
            res.end()
        }
    }
}).listen(8080)
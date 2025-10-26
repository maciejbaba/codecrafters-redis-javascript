const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment the code below to pass the first stage
const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    console.log(data.toString());
    if (data.toString() === "PING\r\n") {
      connection.write("+PONG\r\n");
    } else if (data.toString().startsWith("ECHO ")) {
      connection.write(`+${data.toString().split(" ")[1]}\r\n`);
    } else {
      connection.write("-ERR unknown command 'PING'\r\n");
    }
  });
});
server.listen(6379, "127.0.0.1");

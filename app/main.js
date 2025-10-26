const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment the code below to pass the first stage
const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const commands = data.toString().split("\r\n");
    console.log(commands);
    if (commands[0] === "PING") {
      connection.write("+PONG\r\n");
    } else if (commands[0] === "ECHO") {
      connection.write(`+${commands[1]}\r\n`);
    } else {
      connection.write("-ERR unknown command 'PING'\r\n");
    }
  });
});
server.listen(6379, "127.0.0.1");

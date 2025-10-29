const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment the code below to pass the first stage
const server = net.createServer((connection) => {
  const store = {};
  connection.on("data", (data) => {
    const commands = data.toString().split("\r\n");
    const command = commands[2];
    if (command === "PING") {
      connection.write("+PONG\r\n");
    } else if (command === "ECHO") {
      const message = commands[4];
      connection.write(`+${message}\r\n`);
    } else if (command === "SET") {
      const key = commands[4];
      const value = commands[6];

      const expiry = commands[8];
      const expiryValue = Number(commands[10]);

      if (!expiry || !expiryValue) {
        store[key] = {
          value,
          expiry: null,
        };
        connection.write(`+OK\r\n`);
        return;
      }

      if (expiry === "EX") {
        store[key] = {
          value,
          expiry: Date.now() + expiryValue * 1000,
        };
        connection.write(`+OK\r\n`);
        return;
      } else if (expiry === "PX") {
        store[key] = {
          value,
          expiry: Date.now() + expiryValue,
        };
        connection.write(`+OK\r\n`);
        return;
      }
    } else if (command === "GET") {
      const key = commands[4];
      const storeValue = store[key];
      const expiry = storeValue.expiry;

      if (expiry && Date.now() >= expiry) {
        connection.write(`$-1\r\n`);
        store[key] = undefined;
        return;
      }
      const value = storeValue.value;
      if (value) {
        connection.write(`+${value}\r\n`);
      } else {
        connection.write(`$-1\r\n`);
      }
    } else {
      connection.write("-ERR unknown command\r\n");
    }
  });
});
server.listen(6379, "127.0.0.1");

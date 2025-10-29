const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const store = {};

const pingHandler = (connection) => {
  connection.write("+PONG\r\n");
};

const echoHandler = (connection, commands) => {
  const message = commands[4];
  connection.write(`+${message}\r\n`);
};

const setHandler = (connection, commands) => {
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
};

const getHandler = (connection, commands) => {
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
};

const rPushHandler = (connection, commands) => {
  const listKey = commands[4];

  let startIndex = 6;
  const elements = [];

  while (commands[startIndex]) {
    elements.push(commands[startIndex]);
    startIndex += 2;
  }

  const storeValue = store[listKey];
  if (!storeValue) {
    store[listKey] = [...elements];
  } else {
    store[listKey] = [...store[listKey], ...elements];
  }
  connection.write(`:${store[listKey].length}\r\n`);
};

// Uncomment the code below to pass the first stage
const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const commands = data.toString().split("\r\n");
    const command = commands[2];

    switch (command) {
      case "PING":
        pingHandler(connection);
        break;
      case "ECHO":
        echoHandler(connection, commands);
        break;
      case "SET":
        setHandler(connection, commands);
        break;
      case "GET":
        getHandler(connection, commands);
        break;
      case "RPUSH":
        rPushHandler(connection, commands);
        break;
      default:
        connection.write("-ERR unknown command\r\n");
    }
  });
});
server.listen(6379, "127.0.0.1");

const net = require("net");

const response = {
  emptyArray: "*0\r\n",
  ok: "+OK\r\n",
  pong: "+PONG\r\n",
  emptyGet: "$-1\r\n",
};

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const store = {};

const pingHandler = (connection) => {
  connection.write(response.pong);
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
    connection.write(response.ok);
    return;
  }

  if (expiry === "EX") {
    store[key] = {
      value,
      expiry: Date.now() + expiryValue * 1000,
    };
    connection.write(response.ok);
    return;
  } else if (expiry === "PX") {
    store[key] = {
      value,
      expiry: Date.now() + expiryValue,
    };
    connection.write(response.ok);
    return;
  }
};

const getHandler = (connection, commands) => {
  const key = commands[4];
  const storeValue = store[key];
  const expiry = storeValue.expiry;

  if (expiry && Date.now() >= expiry) {
    connection.write(response.emptyGet);
    store[key] = undefined;
    return;
  }
  const value = storeValue.value;
  if (value) {
    connection.write(`+${value}\r\n`);
  } else {
    connection.write(response.emptyGet);
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

const lRangeHandler = (connection, commands) => {
  const listKey = commands[4];

  const list = store[listKey];

  // not defined list in the store - empty array return
  if (!list) {
    connection.write(response.emptyArray);
    return;
  }

  const startIndex = Number(commands[6]);
  const endIndex = Number(commands[8]);

  // start index bigger than end index - empty array return
  if (startIndex > endIndex && endIndex > 0) {
    connection.write(response.emptyArray);
    return;
  }

  // start greater or equal list length - empty array return
  const listLength = list.length;
  if (startIndex >= listLength) {
    connection.write(response.emptyArray);
    return;
  }

  const requestedList = list.slice(startIndex, endIndex + 1);
  console.log(requestedList);
  let res = `*${requestedList.length}\r\n`;

  requestedList.forEach((element) => {
    res += `$${element.length}\r\n`;
    res += `${element}\r\n`;
  });

  connection.write(res);
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
      case "LRANGE":
        lRangeHandler(connection, commands);
        break;
      default:
        connection.write("-ERR unknown command\r\n");
    }
  });
});
server.listen(6379, "127.0.0.1");

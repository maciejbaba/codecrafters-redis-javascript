const net = require("net");

const response = {
  emptyArray: "*0",
  ok: "+OK",
  pong: "+PONG",
  nullBulkString: "$-1",
  nullArray: "*-1",
  buildArrayResponse: (items) => {
    let res = `*${items.length}`;
    items.filter(Boolean).forEach((element) => {
      res += `\r\n$${element.length}\r\n`;
      res += `${element}`;
    });
    return res;
  },
};

const store = {};

const wait = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const handler = (store) => {
  const getElements = (commands) => {
    let startIndex = 6;
    const elements = [];
    while (commands[startIndex]) {
      elements.push(commands[startIndex]);
      startIndex += 2;
    }
    return elements;
  };

  return {
    ping: () => {
      return response.pong;
    },

    echo: (commands) => {
      const message = commands[4];
      return `+${message}`;
    },

    set: (commands) => {
      const key = commands[4];
      const value = commands[6];

      const expiry = commands[8];
      const expiryValue = Number(commands[10]);

      if (!expiry || !expiryValue) {
        store[key] = {
          value,
          expiry: null,
        };
        return response.ok;
      }

      if (expiry === "EX") {
        store[key] = {
          value,
          expiry: Date.now() + expiryValue * 1000,
        };
        return response.ok;
      } else if (expiry === "PX") {
        store[key] = {
          value,
          expiry: Date.now() + expiryValue,
        };
        return response.ok;
      }
    },

    get: (commands) => {
      const key = commands[4];
      const storeValue = store[key];
      const expiry = storeValue.expiry;

      if (expiry && Date.now() >= expiry) {
        store[key] = undefined;
        return response.nullBulkString;
      }
      const value = storeValue.value;
      if (value) {
        return `+${value}`;
      } else {
        return response.nullBulkString;
      }
    },

    lPush: (commands) => {
      const listKey = commands[4];

      const elements = getElements(commands);

      const storeValue = store[listKey];
      if (!storeValue) {
        store[listKey] = [];
      }

      elements.forEach((element) => {
        store[listKey].unshift(element);
      });

      return `:${store[listKey].length}`;
    },

    rPush: (commands) => {
      const listKey = commands[4];

      const elements = getElements(commands);

      const storeValue = store[listKey];
      if (!storeValue) {
        store[listKey] = [];
      }
      elements.forEach((element) => {
        store[listKey].push(element);
      });

      return `:${store[listKey].length}`;
    },

    lLen: (commands) => {
      const listKey = commands[4];

      const list = store[listKey];
      if (!list) {
        return ":0";
      }

      return `:${list.length}`;
    },

    blPop: async (commands) => {
      const listKey = commands[4];
      const timeout = Number(commands[6]);

      const list = store[listKey];

      // simplest route - list defined and item in it
      if (list) {
        const firstItem = list[0];
        if (firstItem) {
          return response.buildArrayResponse([listKey, list.shift()]);
        }
      }

      if (timeout === 0) {
        while (true) {
          await wait(10);
          const list = store[listKey];
          if (!list) {
            continue;
          }
          const firstItem = list[0];
          if (firstItem) {
            return response.buildArrayResponse([listKey, list.shift()]);
          }
        }
      }

      if (timeout) {
        let totalWait = 0;
        while (totalWait < timeout * 1000) {
          await wait(10);
          totalWait += 10;

          const list = store[listKey];
          if (!list) {
            continue;
          }

          const firstItem = list[0];
          if (firstItem) {
            return response.buildArrayResponse([listKey, list.shift()]);
          }
        }
      }
    },

    lPop: (commands) => {
      const listKey = commands[4];
      const amount = commands[6];

      const list = store[listKey];
      if (!list) {
        return response.nullBulkString;
      }

      // early return - no amount - single lpop - return string single element
      // else process multiple lpops
      if (!amount) {
        return `+${list.shift()}`;
      }

      const items = [];

      for (let i = 0; i < amount; i++) {
        items.push(list.shift());
      }

      return response.buildArrayResponse(items);
    },

    lRange: (commands) => {
      const listKey = commands[4];

      const list = store[listKey];

      // not defined list in the store - empty array return
      if (!list) {
        return response.emptyArray;
      }

      let startIndex = Number(commands[6]);
      const endIndex = Number(commands[8]);

      // positive indexes
      // start index bigger than end index - empty array return
      if (startIndex > endIndex && endIndex > 0) {
        return response.emptyArray;
      }

      // start greater or equal list length - empty array return
      const listLength = list.length;

      // if we have -6 on a 5 length list for example
      // we treat then the start index as a start of the list so we zero it here
      if (Math.abs(startIndex) > listLength) {
        startIndex = 0;
      }

      if (startIndex >= listLength) {
        return response.emptyArray;
      }

      let requestedList = [];
      if (endIndex === -1) {
        requestedList = list.slice(startIndex);
      } else {
        requestedList = list.slice(startIndex, endIndex + 1);
      }

      return response.buildArrayResponse(requestedList);
    },
  };
};

// Uncomment the code below to pass the first stage
const server = net.createServer((connection) => {
  connection.on("data", async (data) => {
    const commands = data.toString().split("\r\n");
    const command = commands[2];

    const h = handler(store);

    let returnText = "";

    switch (command) {
      case "PING":
        returnText = h.ping();
        break;
      case "ECHO":
        returnText = h.echo(commands);
        break;
      case "SET":
        returnText = h.set(commands);
        break;
      case "GET":
        returnText = h.get(commands);
        break;
      case "RPUSH":
        returnText = h.rPush(commands);
        break;
      case "LPUSH":
        returnText = h.lPush(commands);
        break;
      case "LRANGE":
        returnText = h.lRange(commands);
        break;
      case "LLEN":
        returnText = h.lLen(commands);
        break;
      case "LPOP":
        returnText = h.lPop(commands);
        break;
      case "BLPOP":
        returnText = await h.blPop(commands);
        break;
      default:
        returnText = "-ERR unknown command";
    }
    if (returnText) {
      return connection.write(returnText + "\r\n");
    }
  });
});
server.listen(6379, "127.0.0.1");

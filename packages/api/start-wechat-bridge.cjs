require('./dist/index.js')
  .startWeChatBridge()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

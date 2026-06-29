const axios = require("axios");

const url = "https://mygotify.meistermopper.de/message?token=Az-U4FHzRoLLXYk";
const bodyFormData = {
  title: "Hello from Javascript",
  message: "Test Push Service from Node.js",
  priority: 5,
};

axios({
  method: "post",
  headers: {
    "Content-Type": "application/json",
  },
  url: url,
  data: bodyFormData,
})
  .then((response) => console.log(response.data))
  .catch((err) => console.log(err.response ? error.response.data : err));

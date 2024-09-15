import { decode, encode } from 'base-64';

const URL = "https://Minor-Project.onrender.com";
// const URL = "http://192.168.43.242:8080";
// const URL = "http://192.168.43.242:8080";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = [].slice.call(new Uint8Array(buffer));
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return encode(binary);
}

function ping() {
  fetch(URL + "/ping").catch((e) => console.error(e));
}

async function cut(imageURI: string) {
  const formData = new FormData();
  formData.append("data", {
    uri: imageURI,
    name: "photo",
    type: "image/jpg",
  });

  const resp = await fetch(URL + "/cut", {
    method: "POST",
    body: formData,
  }).then(async (res) => {
    console.log("> converting...");
    const buffer = await res.arrayBuffer();
    const base64Flag = "data:image/png;base64,";
    const imageStr = arrayBufferToBase64(buffer);
    return base64Flag + imageStr;
  });

  return resp;
}
async function paste(imageURI: string) {
  const formData = new FormData();
  formData.append("data", {
    uri: imageURI,
    name: "photo",
    type: "image/png",
  });

  const resp = await fetch(URL + "/paste", {
    method: "POST",
    body: formData,
  }).then((r) => r.json());

  return resp;
}

export default {
  ping,
  cut,
  paste,
};

// function dataURItoBlob(dataURI: string): Blob {
//   const byteString = decode(dataURI.split(',')[1]);
//   const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

//   const arrayBuffer = new ArrayBuffer(byteString.length);
//   const dataView = new DataView(arrayBuffer);

//   for (let i = 0; i < byteString.length; i++) {
//     dataView.setUint8(i, byteString.charCodeAt(i));
//   }

//   return new Blob([arrayBuffer], { type: mimeString });
// }

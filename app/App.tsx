import React, { useState, useEffect } from "react";
import { Text, View, Image, TouchableWithoutFeedback, StyleSheet } from "react-native";
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from "expo-image-manipulator";
import { Camera, CameraType } from "expo-camera";

import ProgressIndicator from "./components/ProgressIndicator";
import server from "./components/Server";

const styles = StyleSheet.create({
  resultImgView: {
    position: "absolute",
    zIndex: 200,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  resultImg: {
    position: "absolute",
    zIndex: 300,
    top: "25%",
    left: 0,
    width: "100%",
    height: "50%",
  },
});
    interface State {
      hasPermission: boolean;
      type: CameraType;
      camera: Camera | null;
      currImgSrc: string | null;
    }
export default function App() {
  const [state, setState] = useState<State>({
    hasPermission: false,
    type: CameraType.back,
    camera: null,
    currImgSrc: "",
  });

  const [pressed, setPressed] = useState(false);
  const [pasting, setPasting] = useState(false);

  let camera: any = null;

  useEffect(() => {
    (async () => {
      server.ping();
      const { status } = await Camera.requestCameraPermissionsAsync();
      const hasPermission = status === "granted" ? true : false;
      setState({ ...state, hasPermission });
    })();
  }, []);


  async function cut(){
    const start = Date.now();
    console.log("Cut");

    console.log("> taking image...");
    const opts = { skipProcessing: true, exif: false, quality: 0 };
    let photo = await camera.takePictureAsync(opts);

    console.log("> resizing...");
    let { uri } = await ImageManipulator.manipulateAsync(
          photo.uri,
          [
            { resize: { width: 256, height: 512 } },
            { crop: { originX: 0, originY: 128, width: 256, height: 256 } },
          ]
        );
    if (uri.startsWith('file://')) {
      console.log("File URI detected, converting to base64...");
      const base64Image = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      uri = 'data:image/jpeg;base64,' + base64Image;
    }
    
    const res = await server.cut(uri);

    console.log(`Done in ${((Date.now() - start) / 1000).toFixed(3)}s`);

    return res;
}

  async function paste(imageUri: string) {
    const start = Date.now();
    console.log("");
    console.log("Paste");

    console.log("> sending to /paste...");
    try {
      const resp = await server.paste(imageUri);
      if (resp.status !== "ok") {
        if (resp.status === "screen not found") {
          console.log("screen not found");
        } else {
          throw new Error(resp);
        }
      }
    } catch (e) {
      console.error("error pasting:", e);
    }

    console.log(`Done in ${((Date.now() - start) / 1000).toFixed(3)}s`);
  }

  async function onPressIn() {
    setPressed(true);

    const resp = await cut();
    setState({ ...state, currImgSrc: resp });
  }

  async function onPressOut() {
    setPressed(false);
    setPasting(true);

    if (state.currImgSrc !== "") {
      await paste(state.currImgSrc);
      setState({ ...state, currImgSrc: "" });
      setPasting(false);
    }
  }

  if (state.hasPermission === null) {
    return <View />;
  }
  if (state.hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  let camOpacity = 1;
  if (pressed && state.currImgSrc !== "") {
    camOpacity = 0.8;
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "black" }}
      ></View>
      <Camera
        style={{ flex: 1, opacity: camOpacity }}
        type={state.type}
        ratio="2:1"
        // autoFocus={false}
        // pictureSize="640x480"
        ref={async (ref) => (camera = ref)}
      >
        <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut}>
          <View
            style={{
              flex: 1,
              backgroundColor: "transparent",
              flexDirection: "row",
            }}
          ></View>
        </TouchableWithoutFeedback>
      </Camera>

      {pressed && state.currImgSrc !== "" ? (
        <>
          <View pointerEvents="none" style={styles.resultImgView}>
            <Image
              style={styles.resultImg}
              source={{ uri: state.currImgSrc }}
              resizeMode="stretch"
            />
          </View>
        </>
      ) : null}

      {(pressed && state.currImgSrc === "") || pasting ? <ProgressIndicator /> : null}
    </View>
  );
}
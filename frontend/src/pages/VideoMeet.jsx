import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Badge, IconButton, TextField } from "@mui/material";
import { Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
// import server from "../environment";

const server_url = "http://localhost:8000"; // Backend server URL
var connections = {}; // Object to manage WebRTC peer connections

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // ICE server for NAT traversal
};

export default function VideoMeetComponent() {
  // Refs for managing state and DOM elements
  var socketRef = useRef();
  let socketIdRef = useRef();
  let localVideoref = useRef();

  // State variables for managing app state
  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [video, setVideo] = useState([]);
  let [audio, setAudio] = useState();
  let [screen, setScreen] = useState();
  let [showModal, setModal] = useState(true);
  let [screenAvailable, setScreenAvailable] = useState();
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [newMessages, setNewMessages] = useState(3);
  let [askForUsername, setAskForUsername] = useState(true);
  let [username, setUsername] = useState("");
  const videoRef = useRef([]);
  let [videos, setVideos] = useState([]);

  // Function to get permissions for audio/video
  useEffect(() => {
    getPermissions();
  }, []);

  const getPermissions = async () => {
    try {
      // Request video permissions
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (videoPermission) {
        setVideoAvailable(true);
        console.log("Video permission granted");
      } else {
        setVideoAvailable(false);
        console.log("Video permission denied");
      }

      // Request audio permissions
      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (audioPermission) {
        setAudioAvailable(true);
        console.log("Audio permission granted");
      } else {
        setAudioAvailable(false);
        console.log("Audio permission denied");
      }

      // Check for screen sharing support
      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      // If video or audio is available, initialize local media stream
      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        if (userMediaStream) {
          window.localStream = userMediaStream; // Save media stream globally
          if (localVideoref.current) {
            localVideoref.current.srcObject = userMediaStream; // Assign stream to local video element
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  // Function to handle user connection to socket server
  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false }); // Connect to socket server

    socketRef.current.on("signal", gotMessageFromServer); // Listen for signaling messages

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href); // Emit event to join call
      socketIdRef.current = socketRef.current.id; // Save socket ID

      socketRef.current.on("chat-message", addMessage); // Listen for chat messages

      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id)); // Remove video on user leave
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections
          ); // Create new peer connection

          // Handle ICE candidates
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate != null) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate }) // Send ICE candidate to server
              );
            }
          };

          // Handle remote streams
          connections[socketListId].onaddstream = (event) => {
            let videoExists = videoRef.current.find(
              (video) => video.socketId === socketListId
            );

            if (videoExists) {
              setVideos((videos) => {
                const updatedVideos = videos.map((video) =>
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream } // Update existing video stream
                    : video
                );
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoplay: true,
                playsinline: true,
              };

              setVideos((videos) => {
                const updatedVideos = [...videos, newVideo]; // Add new video stream
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            }
          };

          // Add local stream to new peer connection
          if (window.localStream) {
            connections[socketListId].addStream(window.localStream);
          }
        });
      });
    });
  };

  const gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message); // Parse signaling message

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp)) // Set remote session description
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer() // Create answer to offer
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description) // Set local session description
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        }) // Send answer to server
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice)) // Add ICE candidate
          .catch((e) => console.log(e));
      }
    }
  };

  let silence = () => {
    // Create an AudioContext for generating audio tracks
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator(); // Generate a sound wave
    let dst = oscillator.connect(ctx.createMediaStreamDestination()); // Connect oscillator to a media stream
    oscillator.start(); // Start the oscillator
    ctx.resume(); // Ensure the audio context is active
    // Return an audio track with its `enabled` property set to false
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  let black = ({ width = 640, height = 480 } = {}) => {
    // Create a canvas element for generating a black video track
    let canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height); // Fill the canvas with a black rectangle
    let stream = canvas.captureStream(); // Capture the canvas as a video stream
    // Return a video track with its `enabled` property set to false
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const getDislayMedia = () => {
    // Check if screen sharing is enabled
    if (screen) {
      // Use navigator API to capture screen
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDislayMediaSuccess) // Handle successful screen capture
          .then((stream) => {})
          .catch((err) => console.log(err)); // Log any errors
      }
    }
  };

  // Run when video or audio state changes
  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia(); // Fetch user media when video/audio state is defined
      console.log("SET STATE HAS ", video, audio);
    }
  }, [video, audio]);

  let getMedia = () => {
    setVideo(videoAvailable); // Set video state based on availability
    setAudio(audioAvailable); // Set audio state based on availability
    connectToSocketServer(); // Establish connection with the socket server
  };

  let getUserMediaSuccess = (stream) => {
    try {
      // Stop all existing tracks from the local stream
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e); // Log any errors
    }

    // Assign the new stream to the local stream
    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    // Iterate through each peer connection and add the new stream
    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      // Create and send an offer to the peer
      connections[id].createOffer().then((description) => {
        console.log(description);
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    // Handle the ending of media tracks
    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          // Replace the stream with black video and silence
          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;

          for (let id in connections) {
            connections[id].addStream(window.localStream);

            connections[id].createOffer().then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription })
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        })
    );
  };

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      // Fetch user media with specified audio and video settings
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess) // Handle successful media capture
        .then((stream) => {})
        .catch((e) => console.log(e)); // Log any errors
    } else {
      try {
        let tracks = localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop()); // Stop all existing tracks
      } catch (e) {}
    }
  };

  const getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.log(err);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }
    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setScreen(false);

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;

          getUserMedia(); // Reset to user media after screen sharing ends
        })
    );
  };
  // Toggles for video, audio, and screen sharing
  let handleVideo = () => {
    setVideo(!video);
  };
  let handleAudio = () => {
    setAudio(!audio);
  };

  useEffect(() => {
    if (screen !== undefined) {
      getDislayMedia(); // Handle screen sharing when state changes
    }
  }, [screen]);
  let handleScreen = () => {
    setScreen(!screen);
  };

  let handleEndCall = () => {
    try {
      let tracks = localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop()); // Stop all tracks and end the call
    } catch (e) {}
    window.location.href = "/"; // Redirect to home
  };

  // Chat functionality
  const openChat = () => {
    setModal(true);
    setNewMessages(0); // Reset new message count
  };
  const closeChat = () => {
    setModal(false);
  };
  const handleMessage = (e) => {
    setMessage(e.target.value);
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: sender, data: data },
    ]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prevNewMessages) => prevNewMessages + 1); // Increment new message count for others
    }
  };

  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username); // Send message through socket
    setMessage("");
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia(); // Initialize media connection
  };

  return (
    <div>
      {askForUsername === true ? (
        <div>
          <h2>Enter into Lobby </h2>
          <TextField
            id="outlined-basic"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>

          <div>
            <video ref={localVideoref} autoPlay muted></video>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showModal ? (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <h1>Chat</h1>

                <div className={styles.chattingDisplay}>
                  {messages.length !== 0 ? (
                    messages.map((item, index) => {
                      console.log(messages);
                      return (
                        <div style={{ marginBottom: "20px" }} key={index}>
                          <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                          <p>{item.data}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p>No Messages Yet</p>
                  )}
                </div>

                <div className={styles.chattingArea}>
                  <TextField
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    id="outlined-basic"
                    label="Enter Your chat"
                    variant="outlined"
                  />
                  <Button variant="contained" onClick={sendMessage}>
                    Send
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <></>
          )}

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={handleAudio} style={{ color: "white" }}>
              {audio === true ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            {screenAvailable === true ? (
              <IconButton onClick={handleScreen} style={{ color: "white" }}>
                {screen === true ? (
                  <ScreenShareIcon />
                ) : (
                  <StopScreenShareIcon />
                )}
              </IconButton>
            ) : (
              <></>
            )}

            <Badge badgeContent={newMessages} max={999} color="orange">
              <IconButton
                onClick={() => setModal(!showModal)}
                style={{ color: "white" }}
              >
                <ChatIcon />{" "}
              </IconButton>
            </Badge>
          </div>

          <video
            className={styles.meetUserVideo}
            ref={localVideoref}
            autoPlay
            muted
          ></video>

          <div className={styles.conferenceView}>
            {videos.map((video) => (
              <div key={video.socketId}>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                ></video>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

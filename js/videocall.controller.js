(function () {
  "use strict";
  const app = angular.module("app");
  app.controller("videocallController", videocallController);

  videocallController.$inject = ["$scope", "$location"];
  function videocallController($scope, $location) {
    const APP_ID = "547f42e37376423981c97116de8eebe5";
    const configuration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    let uid = String(Math.floor(Math.random() * 10000));
    let client = null;
    let channel = null;
    let localStream = null;
    let remoteStream = null;
    let peerConnection = null;
    let roomId = $location.search().room;
    const user1 = document.getElementById("user-1");
    const user2 = document.getElementById("user-2");
    const videoSourceSelect = document.getElementById("video-source");
    const container = document.getElementById("video-container");
    const localVideo = document.getElementById("local-video");
    const url =
      "https://vod.api.video/vod/vi5cy5bjAOfKh1oajLM2sHS1/mp4/source.mp4";

    videoSourceSelect.addEventListener("change", init);

    if (!roomId) {
      $location.path("/lobby");
    }

    async function init() {
      const videoSource = videoSourceSelect.value;
      container.innerHTML = "";
      client = await AgoraRTM.createInstance(APP_ID);
      await client.login({ uid, token: null });

      channel = client.createChannel(roomId);
      await channel.join();
      channel.on("MemberJoined", handleMemberJoined);
      channel.on("MemberLeft", handleMemberLeft);

      client.on("MessageFromPeer", handleMessageFromPeer);
      try {
        if (videoSource === "camera") {
          const constraints = {
            video: true,
            audio: false,
          };
          user1.removeAttribute("controls", "");
          localStream = await navigator.mediaDevices.getUserMedia(constraints);
          user1.srcObject = localStream;
        } else if (videoSource === "video") {
          if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
          }
          user1.srcObject = null;

          user1.src = "../videos/chrome.webm";
          user1.setAttribute("controls", "");
          const stream = user1.captureStream();
          localStream = stream;
          peerConnection = new RTCPeerConnection(configuration);
          localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
          });
        }
      } catch (error) {
        console.log("Failed to get local stream:", error);
      }

      async function handleMemberJoined(memberId) {
        createOffer(memberId);
      }

      async function handleMemberLeft(memberId) {
        user2.style.display = "none";
        user1.classList.remove("smallFrame");
      }

      async function handleMessageFromPeer(message, memberId) {
        message = JSON.parse(message.text);

        switch (message.type) {
          case "offer":
            await createAnswer(memberId, message.offer);
            break;
          case "answer":
            addAnswer(message.answer);
            break;
          case "candidate":
            if (peerConnection) {
              peerConnection.addIceCandidate(message.candidate);
            }
            break;
          default:
            console.log("Unknown message type:", message.type);
        }
      }

      async function createPeerConnection(memberId) {
        peerConnection = new RTCPeerConnection(configuration);

        remoteStream = new MediaStream();
        user2.srcObject = remoteStream;
        user2.style.display = "block";
        user1.classList.add("smallFrame");

        if (!localStream) {
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
            user1.srcObject = localStream;
          } catch (error) {
            console.log("Failed to get local stream:", error);
            return;
          }
        }

        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
          });
        };

        peerConnection.onicecandidate = async (event) => {
          if (event.candidate) {
            client.sendMessageToPeer(
              {
                text: JSON.stringify({
                  type: "candidate",
                  candidate: event.candidate,
                }),
              },
              memberId
            );
          }
        };
      }

      async function createOffer(memberId) {
        await createPeerConnection(memberId);

        const offerOptions = {
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        };
        const offer = await peerConnection.createOffer(offerOptions);

        try {
          await peerConnection.setLocalDescription(offer);

          // const videoTrack = remoteStream.getTracks()[0];
          // peerConnection.addTrack(videoTrack, remoteStream);

          client.sendMessageToPeer(
            { text: JSON.stringify({ type: "offer", offer }) },
            memberId
          );
        } catch (error) {
          console.log("Failed to create offer:", error);
        }
      }

      async function createAnswer(memberId, offer) {
        await createPeerConnection(memberId);

        try {
          await peerConnection.setRemoteDescription(offer);

          const answerOptions = {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          };

          const answer = await peerConnection.createAnswer(answerOptions);
          await peerConnection.setLocalDescription(answer);

          client.sendMessageToPeer(
            { text: JSON.stringify({ type: "answer", answer }) },
            memberId
          );
        } catch (error) {
          console.log("Failed to create answer:", error);
        }
      }
    }

    function addAnswer(answer) {
      if (peerConnection && !peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer);
      }
    }

    async function leaveChannel() {
      await channel.leave();
      await client.logout();
    }

    async function toggleCamera() {
      let videoTrack = localStream
        .getTracks()
        .find((track) => track.kind === "video");

      if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById("camera-btn").style.backgroundColor =
          "rgb(255,80,80)";
      } else {
        videoTrack.enabled = true;
        document.getElementById("camera-btn").style.backgroundColor =
          "rgba(179,102,249,.9)";
      }
    }
    async function toggleMic() {
      let audioTrack = localStream
        .getTracks()
        .find((track) => track.kind === "audio");

      if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById("mic-btn").style.backgroundColor =
          "rgb(255,80,80)";
      } else {
        audioTrack.enabled = true;
        document.getElementById("mic-btn").style.backgroundColor =
          "rgba(179,102,249,.9)";
      }
    }

    document
      .getElementById("camera-btn")
      .addEventListener("click", toggleCamera);
    document.getElementById("mic-btn").addEventListener("click", toggleMic);

    window.addEventListener("beforeunload", leaveChannel);

    init();
  }
})();

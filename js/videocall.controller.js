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
    $scope.selectedVideoSource = "camera";

    let uid = String(Math.floor(Math.random() * 10000));
    let client = null;
    let channel = null;
    let localStream = null;
    let remoteStream = null;
    let peerConnection = null;
    let roomId = $location.search().room;
    const user1 = document.getElementById("user-1");
    const user2 = document.getElementById("user-2");
    const container = document.getElementById("video-container");

    if (!roomId) {
      $location.path("/lobby");
    }

    $scope.select = async function () {
      const videoSource = $scope.selectedVideoSource;
      if (videoSource === "camera") {
        await showCamera();
      } else if (videoSource === "video") {
        showFileInput();
      }
    };

    async function showCamera() {
      try {
        const constraints = {
          video: true,
          audio: false,
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        user1.srcObject = localStream;
        user1.removeAttribute("controls");
        $scope.init();
      } catch (error) {
        console.error("Error getting user media:", error);
      }
    }

    function showFileInput() {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "video/*";
      fileInput.addEventListener("change", handleFileInputChange);
      fileInput.click();
    }

    function handleFileInputChange() {
      const file = this.files[0];
      if (!file) {
        return;
      }
      const url = URL.createObjectURL(file);
      stopLocalStreamTracks();
      resetUser1();
      setUser1Src(url);
      setUser1Controls();
      createPeerConnection();
      addLocalStreamTracks();
      $scope.init();
    }

    function stopLocalStreamTracks() {
      if (!localStream) {
        return;
      }
      localStream.getTracks().forEach((track) => track.stop());
    }

    function resetUser1() {
      user1.srcObject = null;
    }

    function setUser1Src(url) {
      user1.src = url;
    }

    function setUser1Controls() {
      user1.setAttribute("controls", "");
    }

    function createPeerConnection() {
      peerConnection = new RTCPeerConnection(configuration);
    }

    function addLocalStreamTracks() {
      localStream = user1.captureStream();
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    $scope.init = async function () {
      container.innerHTML = "";
      client = await AgoraRTM.createInstance(APP_ID);
      await client.login({ uid, token: null });

      channel = client.createChannel(roomId);
      await channel.join();
      channel.on("MemberJoined", handleMemberJoined);
      channel.on("MemberLeft", handleMemberLeft);

      client.on("MessageFromPeer", handleMessageFromPeer);
      

      async function handleMemberJoined(memberId) {
        createOffer(memberId);
      }

      async function handleMemberLeft(memberId) {
        user2.style.display = "none";
        user1.classList.remove("smallFrame");
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
              video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
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
          client.sendMessageToPeer(
            { text: JSON.stringify({ type: "offer", offer }) },
            memberId
          );
        } catch (error) {
          console.log("Failed to create offer:", error);
        }
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
    };

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

    $scope.init();
  }
})();

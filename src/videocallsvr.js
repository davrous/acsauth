// Make sure to install the necessary dependencies
const { CallClient, VideoStreamRenderer, LocalVideoStream } = require('@azure/communication-calling');
const { AzureCommunicationTokenCredential } = require('@azure/communication-common');

const { AzureLogger, setLogLevel } = require("@azure/logger");
// Set the log level and output
// verbose, info, warning, error
setLogLevel('error');
AzureLogger.log = (...args) => {
    console.log(...args);
};

// Calling web sdk objects
let callAgent;
let deviceManager;
let call;
let incomingCall;
let localVideoStream;
let localVideoStreamRenderer;
// json ACS user object return by /api/users/{email}
let ACSUser;
let authUserEmail = "";

// UI widgets
let calleeAcsUserId = document.getElementById('callee-acs-user-id');
let startCallButton = document.getElementById('start-call-button');
let hangUpCallButton = document.getElementById('hangup-call-button');
let acceptCallButton = document.getElementById('accept-call-button');
let startVideoButton = document.getElementById('start-video-button');
let stopVideoButton = document.getElementById('stop-video-button');
let remoteVideoContainer = document.getElementById('remoteVideoContainer');
let localVideoContainer = document.getElementById('localVideoContainer');
let twitterLoginButton = document.getElementsByClassName('twitterButton')[0];
let aadLoginButton = document.getElementsByClassName('aadButton')[0];
let googleLoginButton = document.getElementsByClassName('googleButton')[0];
let githubLoginButton = document.getElementsByClassName('githubButton')[0];
let logoutButton = document.getElementsByClassName('logoutButton')[0];
let meetingLinkInput = document.getElementById('teams-link-input');
let callStateElement = document.getElementById('call-state');
let recordingStateElement = document.getElementById('recording-state');

// 3D
let canvas = document.getElementById("renderCanvas");
let engine = null;
let scene = null;
let sceneToRender = null;
let panel;

// Simple function to check if the user has logged in or not yet
async function getUserInfo() {
    try {
        const response = await fetch('/.auth/me');
        const payload = await response.json();
        const { clientPrincipal } = payload;
        return clientPrincipal;
    } catch (error) {
        console.error('No profile could be found');
        return undefined;
    }
}

async function getUserAcsId(userEmail) {
    try {
        // Calling the API to just try to resolve an email with an existing ACS User ID created
        const response = await fetch('/api/users/' + userEmail + '/true');
        const payload = await response.json();
        const { userId } = payload;
        return userId;
    } catch (error) {
        console.error('No Acs User Id has been found for this email.');
        return undefined;
    }
}

(async function() {
    function registerLoginRouter(button, provider) {
        button.addEventListener("click", () => { 
          window.location.href="/.auth/login/" + provider + "?post_login_redirect_uri=/vr.html";
        });
    }

    registerLoginRouter(twitterLoginButton, "twitter");
    registerLoginRouter(aadLoginButton, "aad");
    registerLoginRouter(githubLoginButton, "github");
    registerLoginRouter(googleLoginButton, "google");

    logoutButton.addEventListener("click", () => {
        window.location.href="/.auth/logout";
    });

    var authenticatedUser = await getUserInfo();
    
    // We can  call the API to get an ACS User ID only if we've been authenticated
    if (authenticatedUser) {
        // If MS provider, we'll get the email address to be used as the key for the DB
        if (authenticatedUser.identityProvider == "aad" || authenticatedUser.identityProvider == "google") {
            authUserEmail=authenticatedUser.userDetails;
        }
        // Otherwise, let's build keys as "davrous@twitter" or "davrous@github"
        else {
            authUserEmail=authenticatedUser.userDetails + "@" + authenticatedUser.identityProvider;
        }
        var ACSUserQuery = await fetch(`/api/users/`+ authUserEmail);
        ACSUser = await ACSUserQuery.json();
        console.log("ACS User Token: " + ACSUser.userToken);
        console.log("Valid until: " + ACSUser.expiresOn);
        document.querySelector('#acs_user_id').textContent = ACSUser.userId;
        document.querySelector('#user_email').textContent = authUserEmail;
        document.querySelector('#loginZone').style.display = "none";
        document.querySelector('#logoutZone').style.display = "block";
        document.querySelector('#acsZone').style.display = "initial";
        try {
            await initializeCallAgent();
            document.querySelector('#initialize-call-agent').style.display = "none";
            document.querySelector('#acsVideoZone').style.display = "initial";
            callStateElement.innerText = '-';
            initializeBabylonEngine();
        }
        catch (error) {
            document.querySelector('#initialize-call-agent').textContent = "Error while initializing agent, please check if the token is valid.";
        }

    }
    else {
        document.querySelector('#user_email').textContent = "Please authenticate";
        document.querySelector('#loginZone').style.display = "initial";
        document.querySelector('#logoutZone').style.display = "none";
    }
}())

/**
 * Using the CallClient, initialize a CallAgent instance with a CommunicationUserCredential which will enable us to make outgoing calls and receive incoming calls. 
 * You can then use the CallClient.getDeviceManager() API instance to get the DeviceManager.
 */
async function initializeCallAgent() {
    try {
        const callClient = new CallClient(); 
        tokenCredential = new AzureCommunicationTokenCredential(ACSUser.userToken);
        callAgent = await callClient.createCallAgent(tokenCredential, {displayName: 'ACS:' + authUserEmail})
        // Set up a camera device to use.
        deviceManager = await callClient.getDeviceManager();
        await deviceManager.askDevicePermission({ video: true });
        await deviceManager.askDevicePermission({ audio: true });
        // Listen for an incoming call to accept.
        callAgent.on('incomingCall', async (args) => {
            try {
                incomingCall = args.incomingCall;
                acceptCallButton.disabled = false;
                startCallButton.disabled = true;
            } catch (error) {
                console.error(error);
            }
        });

        startCallButton.disabled = false;
    } catch(error) {
        throw TypeError("Initializing Call agent failed.");
    }
}

/**
 * Place a 1:1 outgoing video call to a user
 * Add an event listener to initiate a call when the `startCallButton` is clicked:
 * First you have to enumerate local cameras using the deviceManager `getCameraList` API.
 * In this quickstart we're using the first camera in the collection. Once the desired camera is selected, a
 * LocalVideoStream instance will be constructed and passed within `videoOptions` as an item within the
 * localVideoStream array to the call method. Once your call connects it will automatically start sending a video stream to the other participant. 
 */
startCallButton.onclick = async () => {
    try {
        const localVideoStream = await createLocalVideoStream();
        const videoOptions = localVideoStream ? { localVideoStreams: [localVideoStream] } : undefined;
        let meetingLink = meetingLinkInput.value.trim();
        if (meetingLink !== "") {
            // join with meeting link
            call = callAgent.join({meetingLink: meetingLink}, { videoOptions });
        }
        else {
            // Converting email address to internal ACS User Id
            let AcsUserId = await getUserAcsId(calleeAcsUserId.value.trim());
            if (AcsUserId) {
                call = callAgent.startCall([{ communicationUserId: AcsUserId }], { videoOptions });  
            }
            else {
                console.warn("No ACS User Id found.");
            }
        }
        // Subscribe to the call's properties and events.
        if (call) {
            subscribeToCall(call);
        }
    } catch (error) {
        console.error(error);
    }
}

/**
 * Accepting an incoming call with video
 * Add an event listener to accept a call when the `acceptCallButton` is clicked:
 * After subscrigin to the `CallAgent.on('incomingCall')` event, you can accept the incoming call.
 * You can pass the local video stream which you want to use to accept the call with.
 */
acceptCallButton.onclick = async () => {
    try {
        const localVideoStream = await createLocalVideoStream();
        const videoOptions = localVideoStream ? { localVideoStreams: [localVideoStream] } : undefined;
        call = await incomingCall.accept({ videoOptions });
        // Subscribe to the call's properties and events.
        subscribeToCall(call);
    } catch (error) {
        console.error(error);
    }
}

// Subscribe to a call obj.
// Listen for property changes and collection udpates.
subscribeToCall = (call) => {
    try {
        // Inspect the initial call.id value.
        console.log(`Call Id: ${call.id}`);
        //Subsribe to call's 'idChanged' event for value changes.
        call.on('idChanged', () => {
            console.log(`Call Id changed: ${call.id}`); 
        });

        // Inspect the initial call.state value.
        console.log(`Call state: ${call.state}`);
        // Subscribe to call's 'stateChanged' event for value changes.
        call.on('stateChanged', async () => {
            console.log(`Call state changed: ${call.state}`);
            callStateElement.innerText = call.state;
            if(call.state === 'Connected' || call.state === 'InLobby') {
                acceptCallButton.disabled = true;
                startCallButton.disabled = true;
                hangUpCallButton.disabled = false;
                startVideoButton.disabled = false;
                stopVideoButton.disabled = false;
            } else if (call.state === 'Disconnected') {
                startCallButton.disabled = false;
                hangUpCallButton.disabled = true;
                startVideoButton.disabled = true;
                stopVideoButton.disabled = true;
                console.log(`Call ended, call end reason={code=${call.callEndReason.code}, subCode=${call.callEndReason.subCode}}`);
            }   
        });

        call.localVideoStreams.forEach(async (lvs) => {
            localVideoStream = lvs;
            await displayLocalVideoStream();
        });
        call.on('localVideoStreamsUpdated', e => {
            e.added.forEach(async (lvs) => {
                localVideoStream = lvs;
                await displayLocalVideoStream();
            });
            e.removed.forEach(lvs => {
               removeLocalVideoStream();
            });
        });
        
        // Inspect the call's current remote participants and subscribe to them.
        call.remoteParticipants.forEach(remoteParticipant => {
            subscribeToRemoteParticipant(remoteParticipant);
        });
        // Subscribe to the call's 'remoteParticipantsUpdated' event to be
        // notified when new participants are added to the call or removed from the call.
        call.on('remoteParticipantsUpdated', e => {
            // Subscribe to new remote participants that are added to the call.
            e.added.forEach(remoteParticipant => {
                subscribeToRemoteParticipant(remoteParticipant)
            });
            // Unsubscribe from participants that are removed from the call
            e.removed.forEach(remoteParticipant => {
                console.log('Remote participant removed from the call.');
            });
        });
    } catch (error) {
        console.error(error);
    }
}

// Subscribe to a remote participant obj.
// Listen for property changes and collection udpates.
subscribeToRemoteParticipant = (remoteParticipant) => {
    try {
        // Inspect the initial remoteParticipant.state value.
        console.log(`Remote participant state: ${remoteParticipant.state}`);
        // Subscribe to remoteParticipant's 'stateChanged' event for value changes.
        remoteParticipant.on('stateChanged', () => {
            console.log(`Remote participant state changed: ${remoteParticipant.state}`);
        });

        // Inspect the remoteParticipants's current videoStreams and subscribe to them.
        remoteParticipant.videoStreams.forEach(remoteVideoStream => {
            subscribeToRemoteVideoStream(remoteVideoStream)
        });
        // Subscribe to the remoteParticipant's 'videoStreamsUpdated' event to be
        // notified when the remoteParticiapant adds new videoStreams and removes video streams.
        remoteParticipant.on('videoStreamsUpdated', e => {
            // Subscribe to new remote participant's video streams that were added.
            e.added.forEach(remoteVideoStream => {
                subscribeToRemoteVideoStream(remoteVideoStream)
            });
            // Unsubscribe from remote participant's video streams that were removed.
            e.removed.forEach(remoteVideoStream => {
                console.log('Remote participant video stream was removed.');
            })
        });
    } catch (error) {
        console.error(error);
    }
}

/**
 * Subscribe to a remote participant's remote video stream obj.
 * You have to subscribe to the 'isAvailableChanged' event to render the remoteVideoStream. If the 'isAvailable' property
 * changes to 'true', a remote participant is sending a stream. Whenever availability of a remote stream changes
 * you can choose to destroy the whole 'Renderer', a specific 'RendererView' or keep them, but this will result in displaying blank video frame.
 */
subscribeToRemoteVideoStream = async (remoteVideoStream) => {
    // Create a video stream renderer for the remote video stream.
    let videoStreamRenderer = new VideoStreamRenderer(remoteVideoStream);
    let view;
    const renderVideo = async () => {
        try {
            // Create a renderer view for the remote video stream.
            view = await videoStreamRenderer.createView();
            // Attach the renderer view to the UI.
            // remoteVideoContainer.hidden = false;
            // remoteVideoContainer.appendChild(view.target);
            makeVideoButton(view.target.firstChild);
        } catch (e) {
            console.warn(`Failed to createView, reason=${e.message}, code=${e.code}`);
        }	
    }
    
    remoteVideoStream.on('isAvailableChanged', async () => {
        // Participant has switched video on.
        if (remoteVideoStream.isAvailable) {
            await renderVideo();

        // Participant has switched video off.
        } else {
            if (view) {
                view.dispose();
                view = undefined;
            }
        }
    });

    // Participant has video on initially.
    if (remoteVideoStream.isAvailable) {
        await renderVideo();
    }
}

// Start your local video stream.
// This will send your local video stream to remote participants so they can view it.
startVideoButton.onclick = async () => {
    try {
        const localVideoStream = await createLocalVideoStream();
        await call.startVideo(localVideoStream);
    } catch (error) {
        console.error(error);
    }
}

// Stop your local video stream.
// This will stop your local video stream from being sent to remote participants.
stopVideoButton.onclick = async () => {
    try {
        await call.stopVideo(localVideoStream);
    } catch (error) {
        console.error(error);
    }
}

/**
 * To render a LocalVideoStream, you need to create a new instance of VideoStreamRenderer, and then
 * create a new VideoStreamRendererView instance using the asynchronous createView() method.
 * You may then attach view.target to any UI element. 
 */
// Create a local video stream for your camera device
createLocalVideoStream = async () => {
    const camera = (await deviceManager.getCameras())[0];
    if (camera) {
        return new LocalVideoStream(camera);
    } else {
        console.error(`No camera device found on the system`);
    }
}
// Display your local video stream preview in your UI
displayLocalVideoStream = async () => {
    try {
        localVideoStreamRenderer = new VideoStreamRenderer(localVideoStream);
        // const view = await localVideoStreamRenderer.createView();
        // localVideoContainer.hidden = false;
        // localVideoContainer.appendChild(view.target);
    } catch (error) {
        console.error(error);
    } 
}
// Remove your local video stream preview from your UI
removeLocalVideoStream = async() => {
    try {
        localVideoStreamRenderer.dispose();
        localVideoContainer.hidden = true;
    } catch (error) {
        console.error(error);
    } 
}

// End the current call
hangUpCallButton.addEventListener("click", async () => {
    // end the current call
    await call.hangUp();
    callStateElement.innerText = '-';
});

function makeVideoButton(videoElement) {
    var planeOpts = {
        height: 0.09, 
        width: 0.16, 
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    };

    videoPlane = BABYLON.MeshBuilder.CreatePlane("plane", planeOpts, scene);
    var vidPos = (new BABYLON.Vector3(0.0,0.12,-0.05));
    var vidRot = (new BABYLON.Vector3(0,Math.PI,0));
    videoPlane.position = vidPos;
    videoPlane.rotation = vidRot;

    var videoPlaneMat = new BABYLON.StandardMaterial("m", scene);
    var videoTexture = new BABYLON.VideoTexture("vidtex",videoElement, scene);
    videoPlaneMat.diffuseTexture = videoTexture;
    videoPlaneMat.roughness = 1;
    videoPlaneMat.emissiveColor = new BABYLON.Color3.White();
    videoPlane.material = videoPlaneMat;
}

let controllerMesh;
let videoPlane;

// Babylon.js WebGL code. Creating the scene, loading the helmet mesh.
// Activating the render loop with an auto animated camera.
let createScene = function() {
    // Playground needs to return at least an empty scene and default camera
    var scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);

    // Async call
    BABYLON.SceneLoader.Append("https://www.babylonjs.com/Scenes/Espilit/",
        "Espilit.babylon", scene, async function () {
           var xr = await scene.createDefaultXRExperienceAsync({floorMeshes: [scene.getMeshByName("Sols")]});

           // Add controllers to shadow.
            xr.input.onControllerAddedObservable.add((controller) => {
                
                if (controller.onMeshLoadedObservable) {
                    controller.onMeshLoadedObservable.addOnce((rootMesh) => {
                        controllerMesh = rootMesh;
                        videoPlane.parent = controllerMesh;
                    });
                } else {
                    controller.onMotionControllerProfileLoaded.addOnce((motionController) => {
                        motionController.onModelLoadedObservable.addOnce(() => {
                            controllerMesh = motionController.rootMesh;
                            videoPlane.parent = controllerMesh;
                        });
                    });
                }
            });
        });

    return scene;
  };

// var createScene = function () {
//     var scene = new BABYLON.Scene(engine);
//     var camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 2, 5, BABYLON.Vector3.Zero());
//     var light = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0,1,0), scene);
//     var anchor = new BABYLON.TransformNode("");
    
//     camera.wheelDeltaPercentage = 0.01;
//     camera.attachControl(canvas, true);
//     camera.lowerRadiusLimit = 5;
//     camera.upperRadiusLimit = 30;

//     // Define a general environment texture
//     hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("textures/environment.dds", scene);
//     scene.environmentTexture = hdrTexture;

//     scene.createDefaultSkybox(hdrTexture, true, 200, 0.7);

//     // Create the 3D UI manager
//     var manager = new BABYLON.GUI.GUI3DManager(scene);

//     panel = new BABYLON.GUI.SpherePanel();
//     panel.columns = 3;
//     panel.margin = 0.5;
 
//     manager.addControl(panel);
//     panel.linkToTransformNode(anchor);
//     panel.position.z = -1.5;

//     //makePushButtons();
    


//     // function makePushButtons() {
//     //     panel.blockLayout = true;
//     //     for (var i = 0; i < 3; i++) {
//     //         makeVideoButton();
//     //     }
//     //     panel.blockLayout = false;
//     // }

//     return scene;
// };

initializeBabylonEngine = function() {
    engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

    // Add your code here matching the playground format
    scene = createScene(); //Call the createScene function

    // Register a render loop to repeatedly render the scene
    engine.runRenderLoop(function () {
            scene.render();
    });

    // Watch for browser/canvas resize events
    window.addEventListener("resize", function () {
            engine.resize();
    });
};

(function() {
      navigator.mediaDevices.realGUM = navigator.mediaDevices.getUserMedia;

      function fakeGUM(constraints) { 
        return new Promise(function(resolve, reject) {
            try {
                navigator.mediaDevices.realGUM(constraints).then((stream) => {
                console.log("Stream: " + stream);
                resolve(canvas.captureStream());
                });
            } catch (e) {
                console.log(e);
                reject(e);
            }
          });
      }
  
      navigator.mediaDevices.getUserMedia = fakeGUM;
  })();
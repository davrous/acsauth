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
let selectedCameraIndex = 0;
// json ACS user object return by /api/users/{email}
let ACSUser;
let authUserEmail = "";

// HTML UI widgets
let calleeAcsUserId = document.getElementById('callee-acs-user-id');
let startCallButton = document.getElementById('start-call-button');
let hangUpCallButton = document.getElementById('hangup-call-button');
let acceptCallButton = document.getElementById('accept-call-button');
let startVideoButton = document.getElementById('start-video-button');
let stopVideoButton = document.getElementById('stop-video-button');
let twitterLoginButton = document.getElementsByClassName('twitterButton')[0];
let aadLoginButton = document.getElementsByClassName('aadButton')[0];
let googleLoginButton = document.getElementsByClassName('googleButton')[0];
let githubLoginButton = document.getElementsByClassName('githubButton')[0];
let logoutButton = document.getElementsByClassName('logoutButton')[0];
let callStateElement = document.getElementById('call-state');
let camerasSelector = document.getElementById('camerasSelector');
let microsSelector = document.getElementById('microsSelector');
let speakersSelector = document.getElementById('speakersSelector');

// Used by the 3D part
let canvas = document.getElementById("renderCanvas");
let engine = null;
let scene = null;
let sceneToRender = null;
let panel;
let inCall = false;
let incoming = false;
let videoFullPlane;
let videoOnControllerPlane;
let leftControllerMesh;
let videoOnController = false;
let teamsCallButton;
let teamsPlane;
const frameRate = 60;

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

// Calling the API to just try to resolve an email with an existing ACS User ID created
async function getUserAcsId(userEmail) {
    try {
        if (userEmail && userEmail != "") {
            const response = await fetch('/api/users/' + userEmail + '/true');
            const payload = await response.json();
            const { userId } = payload;
            return userId;
        }
        else {
            return undefined;
        }
    } catch (error) {
        console.error('No Acs User Id has been found for: ' + userEmail);
        return undefined;
    }
}

// Executing code now
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
        document.querySelector('#acsZone').style.display = "block";
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

// Used to fill the cameras, microphones & speakers selectors
function fillSelector(devices, selector) {
    devices.forEach((device, index) => {
        selector.add(createOptionElement(device.name, index));
    });  
}

function createOptionElement(text, value) {
    var option = document.createElement("option");
    option.text = text;
    option.value = value;
    return option;
}

async function fillDevicesSelectors() {
    try {
        localCameras = await deviceManager.getCameras();
        if (localCameras) {
            fillSelector(localCameras, camerasSelector);
            camerasSelector.addEventListener("change", (event) => {
                selectedCameraIndex = event.target.value;
            });
        }
    }
    catch (error) {
        console.warn("This device doesn't support cameras enumeration.");
    }

    try {
        localMicrophones = await deviceManager.getMicrophones();    
        if (localMicrophones) {
            fillSelector(localMicrophones, microsSelector, deviceManager.selectMicrophone);
            microsSelector.addEventListener("change", async (event) => {
                await deviceManager.selectMicrophone(localMicrophones[event.target.value]);
            });
        }
    }
    catch (error) {
        console.warn("This device doesn't support microphones enumeration.");
    }

    try {
        localSpeakers = await deviceManager.getSpeakers();
        if (localSpeakers) {
            fillSelector(localSpeakers, speakersSelector, deviceManager.selectSpeaker);
            speakersSelector.addEventListener("change", async (event) => {
                await deviceManager.selectSpeaker(localSpeakers[event.target.value]);
            });
        }
    }
    catch (error) {
        console.warn("This device doesn't support speakers enumeration.");
    }
}

/**
 * Using the CallClient, initialize a CallAgent instance with a CommunicationUserCredential which will enable us to make outgoing calls and receive incoming calls. 
 * You can then use the CallClient.getDeviceManager() API instance to get the DeviceManager.
 */
async function initializeCallAgent() {
    try {
        const callClient = new CallClient(); 
        tokenCredential = new AzureCommunicationTokenCredential(ACSUser.userToken);
        callAgent = await callClient.createCallAgent(tokenCredential, {displayName: 'ACSVR:' + authUserEmail})
        // Set up a camera device to use.
        deviceManager = await callClient.getDeviceManager();
        await deviceManager.askDevicePermission({ video: true });
        await deviceManager.askDevicePermission({ audio: true });
        await fillDevicesSelectors();

        // Listen for an incoming call to accept.
        callAgent.on('incomingCall', async (args) => {
            try {
                incomingCall = args.incomingCall;
                acceptCallButton.disabled = false;
                startCallButton.disabled = true;
                teamsCallButton.textBlock.text = "Accept Call";
                callStateElement.innerText = "Incoming call";
                incoming = true;
            } catch (error) {
                console.error(error);
            }
        });

        startCallButton.disabled = false;
    } catch(error) {
        throw TypeError("Initializing Call agent failed.");
    }
}

startCallButton.addEventListener("click", manageCall);
hangUpCallButton.addEventListener("click", stopCall);
acceptCallButton.addEventListener("click", manageCall);

async function manageCall() {
    if (!inCall) {
        inCall = true;
        if (incoming) {
            await acceptCall();
        }
        else {
            await startCall();
        }
    }
    else {
        await stopCall();
        inCall = false;
    }
}

async function startCall() {
    try {
        const localVideoStream = await createLocalVideoStream();
        const videoOptions = localVideoStream ? { localVideoStreams: [localVideoStream] } : undefined;
        let meetingLink = calleeAcsUserId.value.trim();
        if (meetingLink.includes("teams.microsoft.com")) {
            // join with meeting link
            call = callAgent.join({meetingLink: meetingLink}, { videoOptions });
        }
        else {
            // Converting email address to internal ACS User Id
            let AcsUserId = await getUserAcsId(meetingLink);
            if (AcsUserId) {
                call = callAgent.startCall([{ communicationUserId: AcsUserId }], { videoOptions });  
            }
            else {
                console.error('No Acs User Id has been found for: ' + meetingLink);
                inCall = false;
                incoming = false;
            }
        }
        // Subscribe to the call's properties and events.
        if (call) {
            subscribeToCall(call);
        }
    } catch (error) {
        inCall = false;
        incoming = false;
        console.error(error);
    }
}

async function acceptCall() {
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

async function stopCall() {
    await call.hangUp();
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
            teamsCallButton.textBlock.text = call.state;
            if(call.state === 'Connected') {
                // Switching the 3D elements states in the Scene
                scene.stopAnimation(teamsPlane);
                teamsPlane.setEnabled(false);
                videoFullPlane.setEnabled(true);
                // HTML elements
                acceptCallButton.disabled = true;
                startCallButton.disabled = true;
                hangUpCallButton.disabled = false;
                startVideoButton.disabled = false;
                stopVideoButton.disabled = false;
                teamsCallButton.textBlock.text = "Hang up";
            } else if (call.state === 'Disconnected') {
                incoming = false;
                inCall = false;
                // Switching the 3D elements states in the Scene
                teamsCallButton.textBlock.text = "Call";
                scene.beginAnimation(teamsPlane, 0, frameRate, true, 0.1);
                teamsPlane.setEnabled(true);
                videoFullPlane.setEnabled(false);
                videoOnControllerPlane.setEnabled(false);
                videoOnController = false;
                // HTML elements
                callStateElement.innerText = '-';
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
            makeVideoTexture(view.target.firstChild);
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
    const camera = (await deviceManager.getCameras())[selectedCameraIndex];
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
    } catch (error) {
        console.error(error);
    } 
}
// Remove your local video stream preview from your UI
removeLocalVideoStream = async() => {
    try {
        localVideoStreamRenderer.dispose();
    } catch (error) {
        console.error(error);
    } 
}

function makeVideoTexture(videoElement) {
    var videoPlaneMat = new BABYLON.StandardMaterial("m", scene);
    var videoTexture = new BABYLON.VideoTexture("vidtex",videoElement, scene);
    videoPlaneMat.diffuseTexture = videoTexture;
    videoPlaneMat.roughness = 1;
    videoPlaneMat.emissiveColor = BABYLON.Color3.White();
    videoOnControllerPlane.material = videoPlaneMat;
    videoFullPlane.material = videoPlaneMat;
}

// Babylon.js WebGL code. Creating the scene, loading the helmet mesh.
// Activating the render loop with an auto animated camera.
let createScene = function() {
    // Playground needs to return at least an empty scene and default camera
    var scene = new BABYLON.Scene(engine);
    // This creates and positions a free camera (non-mesh)
    var camera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // Async call
    BABYLON.SceneLoader.Append("https://www.babylonjs.com/Scenes/Espilit/",
        "Espilit.babylon", scene, async function () {
            var light = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene);
            var xr = await scene.createDefaultXRExperienceAsync({floorMeshes: [scene.getMeshByName("Sols")]});
            xr.baseExperience.enableSpectatorMode();

            var planeOpts = {
                height: 0.09, 
                width: 0.16, 
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            };

            videoOnControllerPlane = BABYLON.MeshBuilder.CreatePlane("videoOnControllerPlane", planeOpts, scene);
            var vidPos = (new BABYLON.Vector3(0.0,0.12,-0.05));
            var vidRot = (new BABYLON.Vector3(1,Math.PI,0));
            videoOnControllerPlane.position = vidPos;
            videoOnControllerPlane.rotation = vidRot;
            videoOnControllerPlane.setEnabled(false);

            var fullPlaneOpts = {
                height: 1.35, 
                width: 2.4, 
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            };

            videoFullPlane = BABYLON.MeshBuilder.CreatePlane("videoFullPlane", fullPlaneOpts, scene);
            var vidPos = (new BABYLON.Vector3(-2.82, 2.16, 4.44));
            var vidRot = (new BABYLON.Vector3(0,0,0));
            videoFullPlane.position = vidPos;
            videoFullPlane.rotation = vidRot;
            videoFullPlane.setEnabled(false);

           	const teamsPlaneMat = new BABYLON.StandardMaterial("");
            teamsPlaneMat.opacityTexture = new BABYLON.Texture("https://david.blob.core.windows.net/acs/MSTeamsLogo.png");
            teamsPlaneMat.diffuseTexture = new BABYLON.Texture("https://david.blob.core.windows.net/acs/MSTeamsLogo.png");
            teamsPlaneMat.emissiveColor = BABYLON.Color3.White();
            
            teamsPlane = BABYLON.MeshBuilder.CreatePlane("teamsPlane", {size: 1.5, sideOrientation: BABYLON.Mesh.DOUBLESIDE});
            teamsPlane.position = new BABYLON.Vector3(-2.82, 2.16, 4.44);
            teamsPlane.material = teamsPlaneMat;
      
            const teamsCallButtonPlane = BABYLON.MeshBuilder.CreatePlane("teamsPlane", {size: 1, sideOrientation: BABYLON.Mesh.DOUBLESIDE});
            teamsCallButtonPlane.position = new BABYLON.Vector3(-2.82, 1, 4.44);

            var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(teamsCallButtonPlane);

            teamsCallButton = BABYLON.GUI.Button.CreateImageWithCenterTextButton("teamsCallButton", "Call", "https://david.blob.core.windows.net/acs/calliconMDL2.png");
            teamsCallButton.width = 0.5;
            teamsCallButton.height = 0.5;
            teamsCallButton.color = "white";
            teamsCallButton.fontSize = 50;
            teamsCallButton.cornerRadius = 20;
            teamsCallButton.background = "#4E5A67";
            teamsCallButton.image.scaleX = 0.5;
            teamsCallButton.image.scaleY = 0.5;
            teamsCallButton.image.paddingTop = "20%";
            teamsCallButton.textBlock.paddingBottom = "20%";
            advancedTexture.addControl(teamsCallButton);
      
            teamsCallButton.onPointerUpObservable.add(manageCall);

            scene.activeCamera.attachControl(canvas, false);
            camera = scene.activeCamera;

            xr.input.onControllerAddedObservable.add((controller) => {
                controller.onMotionControllerInitObservable.add((motionController) => {
                    if (motionController.handness === 'left') {                       
                        if (controller.onMeshLoadedObservable) {
                            controller.onMeshLoadedObservable.addOnce((rootMesh) => {
                                leftControllerMesh = rootMesh;
                            });
                        } else {
                            controller.onMotionControllerProfileLoaded.addOnce((motionController) => {
                                motionController.onModelLoadedObservable.addOnce(() => {
                                    leftControllerMesh = motionController.rootMesh;
                                });
                            });
                        }
                    }
                    else {
                        const xr_ids = motionController.getComponentIds();
                        let abuttonComponent = motionController.getComponent(xr_ids[3]);//a-button
                        abuttonComponent.onButtonStateChangedObservable.add(() => {
                            if (inCall && abuttonComponent.pressed) {
                                if (!videoOnController) {
                                    videoOnControllerPlane.parent = leftControllerMesh;
                                    videoFullPlane.setEnabled(false);
                                    videoOnControllerPlane.setEnabled(true);
                                    videoOnController = true;
                                }
                                else {
                                    videoOnControllerPlane.parent = null;
                                    videoOnControllerPlane.setEnabled(false);
                                    videoFullPlane.setEnabled(true);
                                    videoOnController = false;
                                }
                            }
                        });
                    }
                });
            });

            const teamsRotation = new BABYLON.Animation("teamsRotation", "rotation.y", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
            const keyFrames = []; 

            keyFrames.push({
                frame: 0,
                value: 0
            });

            keyFrames.push({
                frame: frameRate,
                value: Math.PI * 2
            });

            teamsRotation.setKeys(keyFrames);
            teamsPlane.animations.push(teamsRotation);
            scene.beginAnimation(teamsPlane, 0, frameRate, true, 0.1);
        });

    return scene;
  };

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

// Mock getUserMedia to return the 3D Canvas rendering stream
// Instead of the camera video feed
(function() {
    navigator.mediaDevices.realGUM = navigator.mediaDevices.getUserMedia;

    function fakeGUM(constraints) { 
      return new Promise(function(resolve, reject) {
          try {
              console.log("constraints: " + constraints);
              navigator.mediaDevices.realGUM(constraints).then((stream) => {
                if (constraints.audio) {
                    console.log("Sending normal audio feed.");
                    resolve(stream);
                }
                if (constraints.video) {
                    console.log("Sending Metaverse rendering instead of video feed.");
                    resolve(canvas.captureStream(30));
                }                  
              });
          } catch (e) {
              console.log(e);
              reject(e);
          }
        });
    }

    navigator.mediaDevices.getUserMedia = fakeGUM;
})();

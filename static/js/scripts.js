// static/js/scripts.js

const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const heightInput = document.getElementById('height-input');
const shoulderWidthOutput = document.getElementById('shoulder-width');
const sleeveLengthOutput = document.getElementById('sleeve-length');
const totalLengthOutput = document.getElementById('total-length');
const hemWidthOutput = document.getElementById('hem-width');
const feedbackElement = document.getElementById('feedback');
const countdownElement = document.getElementById('countdown');

let userHeightCm = parseFloat(heightInput.value);
heightInput.addEventListener('change', () => {
    userHeightCm = parseFloat(heightInput.value);
});

let countdown = 3;
let countdownInterval = null;
let lastPoseLandmarks = null;
let measurements = null; // 측정값 저장용

function resetCountdown() {
    clearInterval(countdownInterval);
    countdownInterval = null;
    countdown = 3;
    countdownElement.innerText = '';
}

function startCountdown() {
    countdownElement.innerText = countdown;
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownElement.innerText = countdown;
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownElement.innerText = '결과는 아래에서 확인'; // 카운트다운 완료 시 "측정 완료" 출력

            // 측정 완료 메시지를 2초간 표시한 후 측정 수행
            setTimeout(() => {
                performMeasurement();
            }, 2000); // 2000ms = 2초
        }
    }, 1000);
}


// **performMeasurement 함수 정의**
function performMeasurement() {
    // 현재 랜드마크를 사용하여 신체 치수 계산
    if (lastPoseLandmarks) {
        calculateMeasurements(lastPoseLandmarks);
    } else {
        feedbackElement.innerText = '측정할 수 없습니다. 다시 시도해주세요.';
    }
    // 카운트다운 초기화
    resetCountdown();
}

// MediaPipe Pose 모델 초기화
const pose = new Pose({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4/${file}`;
    }
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(onResults);


// 비디오와 캔버스의 크기를 동기화하는 함수
function resizeCanvas() {
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (videoWidth && videoHeight) {
        canvasElement.width = videoWidth;
        canvasElement.height = videoHeight;
    }
}

// 비디오의 메타데이터가 로드되면 캔버스 크기 조정
videoElement.addEventListener('loadedmetadata', () => {
    resizeCanvas();
});

// 창 크기가 변경될 때 캔버스 크기 조정
window.addEventListener('resize', () => {
    resizeCanvas();
});


// 웹캠 설정
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({ image: videoElement });
    }
});
camera.start();


function onResults(results) {
    if (!results.poseLandmarks) {
        feedbackElement.innerText = '신체가 감지되지 않습니다. 화면에 전체 신체가 나오도록 해주세요.';
        resetCountdown();
        return;
    }

    lastPoseLandmarks = results.poseLandmarks;

    // 캔버스 초기화 및 좌우 반전 적용
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // 좌우 반전 설정
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);

    // 영상 그리기
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // 수직 가이드 라인 그리기
    drawVerticalGuidelines();

    // 랜드마크와 연결선 그리기
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
        { color: '#00FF00', lineWidth: 4 });
    drawLandmarks(canvasCtx, results.poseLandmarks,
        { color: '#FF0000', lineWidth: 2 });

    // 측정값이 있으면 시각화
    if (measurements) {
        drawMeasurements(measurements);
    }

    // 좌우 반전 설정 해제
    canvasCtx.restore();

    // 사용자 위치 검증 및 카운트다운 처리
    validateUserPosition(results.poseLandmarks);
}

function drawVerticalGuidelines() {
    const lineX1 = canvasElement.width * 0.3;
    const lineX2 = canvasElement.width * 0.7;

    canvasCtx.strokeStyle = 'yellow';
    canvasCtx.lineWidth = 3;

    // 왼쪽 수직선
    canvasCtx.beginPath();
    canvasCtx.moveTo(lineX1, 0);
    canvasCtx.lineTo(lineX1, canvasElement.height);
    canvasCtx.stroke();

    // 오른쪽 수직선
    canvasCtx.beginPath();
    canvasCtx.moveTo(lineX2, 0);
    canvasCtx.lineTo(lineX2, canvasElement.height);
    canvasCtx.stroke();

    // 가이드라인 박스 그리기 (선택 사항)
    canvasCtx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeRect(lineX1, 0, lineX2 - lineX1, canvasElement.height);
}

function validateUserPosition(landmarks) {
    const leftShoulder = landmarks[11]; // 왼쪽 어깨
    const rightShoulder = landmarks[12]; // 오른쪽 어깨

    // 좌우 반전된 영상에 맞게 X 좌표 변환
    const leftShoulderX = (1 - leftShoulder.x) * canvasElement.width-0.1;
    const rightShoulderX = (1 - rightShoulder.x) * canvasElement.width;

    const lineX1 = canvasElement.width * 0.3;
    const lineX2 = canvasElement.width * 0.7;

    if (leftShoulderX > lineX1 && rightShoulderX < lineX2) {
        feedbackElement.innerText = '';
        if (!countdownInterval) {
            startCountdown();
        }
    } else {
        feedbackElement.innerText = '양쪽 어깨를 가이드라인 박스 안에 맞춰주세요.';
        resetCountdown();
    }
}

function calculateMeasurements(landmarks) {
    const n = 10; // 어깨 랜드마크 조정을 위한 픽셀 오프셋

    // 필요한 랜드마크 추출
    const leftShoulder = landmarks[11]; // 왼쪽 어깨
    const rightShoulder = landmarks[12]; // 오른쪽 어깨
    const leftWrist = landmarks[15]; // 왼쪽 손목
    const rightWrist = landmarks[16]; // 오른쪽 손목
    const leftHip = landmarks[23]; // 왼쪽 골반
    const rightHip = landmarks[24]; // 오른쪽 골반
    const nose = landmarks[0]; // 코

    // 모든 랜드마크가 감지되었는지 확인
    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist || !leftHip || !rightHip || !nose) {
        console.error('필요한 랜드마크가 감지되지 않았습니다.');
        shoulderWidthOutput.innerText = '측정 불가';
        return;
    }

    // 좌표를 픽셀 단위로 변환 (좌우 반전 고려)
    const leftShoulderX = (1 - leftShoulder.x) * canvasElement.width;
    const leftShoulderY = leftShoulder.y * canvasElement.height;
    const rightShoulderX = (1 - rightShoulder.x) * canvasElement.width ;
    const rightShoulderY = rightShoulder.y * canvasElement.height;

    const leftWristX = (1 - leftWrist.x) * canvasElement.width;
    const leftWristY = leftWrist.y * canvasElement.height;
    const rightWristX = (1 - rightWrist.x) * canvasElement.width;
    const rightWristY = rightWrist.y * canvasElement.height;

    const leftHipX = (1 - leftHip.x) * canvasElement.width;
    const leftHipY = leftHip.y * canvasElement.height;
    const rightHipX = (1 - rightHip.x) * canvasElement.width;
    const rightHipY = rightHip.y * canvasElement.height;

    const noseX = (1 - nose.x) * canvasElement.width;
    const noseY = nose.y * canvasElement.height;

    // 측정값 계산 (픽셀 단위)
    const shoulderWidthPx = Math.hypot(leftShoulderX - rightShoulderX, leftShoulderY - rightShoulderY);

    const leftSleeveLengthPx = Math.hypot(leftShoulderX - leftWristX, leftShoulderY - leftWristY);
    const rightSleeveLengthPx = Math.hypot(rightShoulderX - rightWristX, rightShoulderY - rightWristY);
    const sleeveLengthPx = (leftSleeveLengthPx + rightSleeveLengthPx) / 2;

    const torsoHeightPx = Math.abs(((leftShoulderY + rightShoulderY) / 2) - ((leftHipY + rightHipY) / 2));

    const hemWidthPx = Math.hypot(leftHipX - rightHipX, leftHipY - rightHipY);

    // 신체 전체 높이 픽셀 값 (코부터 골반 중간까지)
    const totalHeightPx = Math.hypot(noseX - ((leftHipX + rightHipX) / 2), noseY - ((leftHipY + rightHipY) / 2));

    if (totalHeightPx === 0 || isNaN(totalHeightPx)) {
        console.error('신체 높이 픽셀 값이 0 또는 NaN입니다.');
        shoulderWidthOutput.innerText = '측정 불가';
        return;
    }

    // 스케일 변환
    const scale = userHeightCm / totalHeightPx / 1.9;

    // 측정값을 센티미터로 변환
    const shoulderWidthCm = shoulderWidthPx * scale;
    const sleeveLengthCm = sleeveLengthPx * scale;
    const totalLengthCm = torsoHeightPx * scale;
    const hemWidthCm = hemWidthPx * scale;

    // 측정값 저장
    measurements = {
        leftShoulderX,
        leftShoulderY,
        rightShoulderX,
        rightShoulderY,
        leftHipX,
        leftHipY,
        rightHipX,
        rightHipY,
        leftWristX,
        leftWristY,
        rightWristX,
        rightWristY,
        shoulderWidthCm,
        sleeveLengthCm,
        totalLengthCm,
        hemWidthCm,
    };

    // 결과 표시
    shoulderWidthOutput.innerText = shoulderWidthCm.toFixed(2) + ' cm';
    sleeveLengthOutput.innerText = sleeveLengthCm.toFixed(2) + ' cm';
    totalLengthOutput.innerText = totalLengthCm.toFixed(2) + ' cm';
    hemWidthOutput.innerText = hemWidthCm.toFixed(2) + ' cm';
}

function drawMeasurements(measurements) {
    // 어깨 선 그리기
    canvasCtx.strokeStyle = 'red';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(measurements.leftShoulderX, measurements.leftShoulderY);
    canvasCtx.lineTo(measurements.rightShoulderX, measurements.rightShoulderY);
    canvasCtx.stroke();

    // 왼쪽 소매 선 그리기
    canvasCtx.strokeStyle = 'green';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(measurements.leftShoulderX, measurements.leftShoulderY);
    canvasCtx.lineTo(measurements.leftWristX, measurements.leftWristY);
    canvasCtx.stroke();

    // 오른쪽 소매 선 그리기
    canvasCtx.beginPath();
    canvasCtx.moveTo(measurements.rightShoulderX, measurements.rightShoulderY);
    canvasCtx.lineTo(measurements.rightWristX, measurements.rightWristY);
    canvasCtx.stroke();

    // 총기장 선 그리기 (어깨부터 골반까지)
    const midShoulderX = (measurements.leftShoulderX + measurements.rightShoulderX) / 2;
    const midShoulderY = (measurements.leftShoulderY + measurements.rightShoulderY) / 2;
    const midHipX = (measurements.leftHipX + measurements.rightHipX) / 2;
    const midHipY = (measurements.leftHipY + measurements.rightHipY) / 2;

    canvasCtx.strokeStyle = 'blue';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(midShoulderX, midShoulderY);
    canvasCtx.lineTo(midHipX, midHipY);
    canvasCtx.stroke();

    // 밑단 선 그리기
    canvasCtx.strokeStyle = 'orange';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(measurements.leftHipX, measurements.leftHipY);
    canvasCtx.lineTo(measurements.rightHipX, measurements.rightHipY);
    canvasCtx.stroke();
}

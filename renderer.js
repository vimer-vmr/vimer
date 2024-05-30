// == General settings ==
const config = {
    configFilename: null,
    participantCode: null,
    video: {
        filename: null,
        duration: null,
        breakpoints: null,
        currentSegment: 0
    },
    store: {
        outputFolder: null,
        fields: null
    },
    config: {
        general: {
            timing: {
                type: "absolute",
                interval: 30,
                segments: 10
            },
            labels: {
                previous: "Previous",
                next: "Next",
                submit: "Submit",
                play: "Play video",
                replay: "Replay"
            },
            ui: {
                showPreviousButton: true,
                showReplayButton: true,
                videoWidth: "75",
                image: "assets/all_uni_logo.png"
            },
        },
        instructions: {
            title: "Instruction title not set",
            text: "Instruction text not set."
        },
        survey: {},
        outro: {
            title: "Outro title not set",
            text: "Outro text not set."
        }
    }
}

// == Utility functions ==
function updateObject(theTarget, theSource) { // TODO: This should work recursively. Now only 1 level is copied.
    for(var propertyName in theTarget)theSource[propertyName]&&(theTarget[propertyName]=theSource[propertyName]);

    return theTarget;
}

function range(start, end, step = 1) {
    const len = Math.floor((end - start) / step) + 1;
    return Array(len).fill().map((_, idx) => start + (idx * step));
}

function setRequired(parent, value) {
    nodeList = parent.querySelectorAll('input, textarea, select');
    for (let i = 0; i < nodeList.length; i++) {
        let item = nodeList[i];
        item.required = value;
    }
    nodeList = parent.querySelectorAll('input[type=range]');
    for (let i = 0; i < nodeList.length; i++) {
        let item = nodeList[i];
        if (item.classList.contains('range-thumb-hide')) {
            item.setCustomValidity(value ? "Please select a value." : "");
        }
    }
}

function extractValue(arr, prop) {
    let extractedValue = arr.map(item => item[prop]);

    return extractedValue;
}

// == Storage ==
function writeCsvHeader() {
    csv_header = config.store.fields.join(';') + "\n";
    window.electronAPI.storeData(config.store.outputFolder, config.participantCode, config.configFilename, config.video.filename, csv_header);
}

function writeCsvData() {
    const replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here

    admin_data = {
        'participantCode': config.participantCode,
        'responseTimestamp': new Date().toISOString(),
        'segmentStartTimestamp': config.video.breakpoints[config.video.currentSegment],
        'segmentEndTimestamp': config.video.breakpoints[config.video.currentSegment + 1]
    };

    let data = [];
    config.store.fields.map(key => data[key] = questionsForm[key]?.value ? questionsForm[key].value : admin_data[key]);
    csv_data = config.store.fields.map(fieldName => JSON.stringify(data[fieldName], replacer)).join(';') + "\n";
    window.electronAPI.storeData(config.store.outputFolder, config.participantCode, config.configFilename, config.video.filename, csv_data);
}


// == Panes ==
const setupPane = document.querySelector("#setupPane");
const instructionPane = document.querySelector("#instructionPane");
const videoPane = document.querySelector("#videoPane");
const outroPane = document.querySelector("#outroPane");


// == Setup pane ==
const setupForm = document.querySelector("#setupForm");
const exampleVideo = document.querySelector("#exampleVideo");
const participantCode = document.querySelector("#participantCode");
const videoFileSelect = document.querySelector("#videoFileSelect");
const configFileSelect = document.querySelector("#configFileSelect");
const outputFolderSelect = document.querySelector("#outputFolderSelect");
const logo = document.querySelector("#logo");

function initSetupPane() {

}

function finishSetupPane() {
    exampleVideo.pause();
    setupPane.classList.add("d-none");
}

function updateBreakpoints() {
    let interval;
    let duration = config.video.duration;
    switch (config.config.general.timing.type) {
        default:
        case "absolute":
            interval = config.config.general.timing.interval;
            break;
        case "relative":
            interval = config.video.duration / config.config.general.timing.segments;
            config.config.general.timing.interval = interval;
            break;
    }
    config.video.breakpoints = range(0, duration, interval);
}

outputFolderSelect.addEventListener("click", async (event) => {
    event.preventDefault();
    const outputFolder = await window.electronAPI.openDirectory()
    if (outputFolder !== undefined) {
        outputFolderSelect.value = outputFolder;
    } else {
        outputFolderSelect.value = "";
    }
});

videoFileSelect.addEventListener("change", function() {
    try {
        exampleVideo.src = videoFileSelect.files[0].path;
    } catch(error) {
        exampleVideo.src = "";
        config.video.duration = null;
    }
});

exampleVideo.addEventListener("loadedmetadata", () => {
    config.video.duration = exampleVideo.duration;
});

setupForm.addEventListener("submit", function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (setupForm.checkValidity()) {
        config.video.filename = videoFileSelect.files[0].path;
        config.configFilename = configFileSelect.files[0].path;
        config.participantCode = participantCode.value;
        config.store.outputFolder = outputFolderSelect.value;

        configFromFile = window.electronAPI.readconfig(config.configFilename);

        config.config = updateObject(config.config, configFromFile);

        updateBreakpoints();

        logo.src = config.config.general.ui.image;

        adminFields = ['participantCode', 'responseTimestamp', 'segmentStartTimestamp', 'segmentEndTimestamp'];
        config.store.fields = [adminFields, config.config.survey.map(item => extractValue(item.questions, 'label')).flat()].flat();

        writeCsvHeader();

        finishSetupPane();
            initInstructionPane();
    }
    setupForm.classList.add("was-validated");
});


// == Instruction pane ==
const instructionNextButton = document.querySelector("#instructionNextBtn");
const instructionText = document.querySelector("#instructionText");

function initInstructionPane() {
    instructionPane.classList.remove("d-none");

    regex = /(?:\r\n|\r|\n)/g;
    instructionText.innerHTML = "<h1>" + config.config.instructions.title + "</h1><p>" + config.config.instructions.text.replaceAll(regex, '<br/>') + "</p>"
    instructionNextButton.innerHTML = config.config.general.labels.next;
}

function finishInstructionPane() {
    instructionPane.classList.add("d-none");
}

instructionNextButton.addEventListener("click", function () {
    finishInstructionPane();
    initVideoPane();
});


// == Video play pane ==
const video = document.querySelector("#video");
const playButton = document.querySelector("#playVideo");
const videoFrame = document.querySelector("#video");
const questionsForm = document.querySelector("#questionsForm");
const replayButton = document.querySelector("#replayVideo");

function radiobuttonAnswer(label, question, options) {
    optionsTpl = "";
    for (key in options) {
        option = options[key];

        optionsTpl +=  `<div class="form-check">
                            <input class="form-check-input" type="radio" name="${label}" id="${label + '_' + key}" value="${option}" required>
                            <label class="form-check-label" for="${label + '_' + key}">
                                ${option}
                            </label>
                        </div>`;
    }

    template = `<div class="mb-3">
                    <p>${question}</p>
                    ${optionsTpl}
                </div>`;

    return template;
}

function likertAnswer(label, question, options) {
    showValueClass = options['show-value'] ? '' : 'd-none';

    valuesTpl = "";
    labelTpl = "";
    optionsTpl = "";
    values = options['values']
    for (key in values) {
        option = values[key];
        likertValue = typeof values[key][0] != 'undefined' ? values[key][0] : '';
        likertlabel = typeof values[key][1] != 'undefined' ? values[key][1] : '';

        valuesTpl +=    `<div class="col align-self-end">
                            ${likertValue}
                        </div>`

        labelTpl +=    `<div class="col align-self-begin">
                            ${likertlabel}
                        </div>`

        optionsTpl +=  `<div class="col">
                            <input class="form-check-input" type="radio" name="${label}" id="${label + '_' + key}" value="${values[key][0]}" required>
                        </div>`;
    }

    template = `<div class="mb-3">
                    <p>${question}</p>
                    <div class="row text-center ${showValueClass}">
                        ${valuesTpl}
                    </div>
                    <div class="row likert text-center">
                    ${optionsTpl}
                    </div>
                    <div class="row text-center">
                        ${labelTpl}
                    </div>
                </div>`;

    return template;
}

function freetextAnswer(label, question, options) {
    template = `<div class="mb-3">
                    <label for="text" class="form-label">${question}</label>
                    <textarea class="form-control" name="${label}" id="${label}" rows="3" required></textarea>
                </div>`;

    return template;
}

function addSliderThumb(slider) {
    slider.classList.remove('range-thumb-hide');
    slider.setCustomValidity('');
}

function showSliderValue(slider) {
    slider.previousSibling.previousSibling.innerHTML = slider.value;
}

function sliderAnswer(label, question, options) {
    showValueClass = options['show-value'] ? '' : 'd-none';
    template = `<div class="mb-3">
                    <p>${question}</p>
                    <div class="range-value ${showValueClass}">&nbsp;</div>
                    <input type="range" min="${options['min']}" max="${options['max']}" class="form-range range-custom range-thumb-hide" id="${label}" onchange="addSliderThumb(this);" oninput="showSliderValue(this);">
                    <div class="row">
                        <div class="col text-begin">${options['labels']['left']}</div><div class="col text-center">${options['labels']['center']}</div><div class="col text-end">${options['labels']['right']}</div>
                    </div>
                </div>`;

    return template;
}

function gridAnswer(label, question, options) {
    n = options['size'];
    items = ``

    for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
            items += `<input class="form-check-input grid-item" type="radio" name="${label}" value="x=${j+1},y=${i+1}">`;
        }
    }

    template  = `<div class="mb-3">
                    <p>${question}</p>
                    <div class="row">
                        <div class="col col-2 text-end">${options['labels']['left-top']}</div><div class="col col-8 text-center">${options['labels']['center-top']}</div><div class="col col-2 text-begin">${options['labels']['right-top']}</div>
                    </div>
                    <div class="row">
                        <div class="col col-1 d-flex align-items-center">
                            <div class="vertical-text-270 text-center">${options['labels']['left-center']}</div>
                        </div>
                        <div class="col col-10">
                            <div class="grid grid-${options['size']}">
                                ${items}
                            </div>
                        </div>
                        <div class="col col-1 d-flex align-items-center">
                            <div class="vertical-text-90 text-center">${options['labels']['right-center']}</div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col col-2 text-end">${options['labels']['left-bottom']}</div><div class="col col-8 text-center">${options['labels']['center-bottom']}</div><div class="col col-2 text-begin">${options['labels']['right-bottom']}</div>
                    </div>
                </div>`;

    return template;
}

function addSurveyStep(title, description, questions) {
    template = `<div class="step d-none">
                    <h2>${title}</h2>
                    <p>${description}</p>
                    ${questions}
                </div>`;

    return template;
}

function addQuestion(questionObj) {
    label = questionObj.label;
    type = questionObj.type;
    question = questionObj.question;
    options = questionObj.options;

    switch(type) {
        default:
        case "text":
            questionTpl = freetextAnswer(label, question, options);
            break;
        case "radio":
            questionTpl = radiobuttonAnswer(label, question, options);
            break;
        case "likert":
            questionTpl = likertAnswer(label, question, options);
            break;
        case "slider":
            questionTpl = sliderAnswer(label, question, options);
            break;
        case "grid":
            questionTpl = gridAnswer(label, question, options);
            break;
    }
    questionTpl += `<div class="spacer"></div>`;

    return questionTpl;
}

function addSurvey() {
    const stepscontainer = questionsForm.querySelector("#steps-container");

    pages = "";
    for (key in config.config.survey) {
        page = config.config.survey[key];
        title = page.page;
        description = page.description;
        questionsTpl = "";
        for (key in page.questions) {
            question = page.questions[key];
            questionsTpl += addQuestion(question);
        }
        pages += addSurveyStep(title, description, questionsTpl);
    }

    stepscontainer.innerHTML = pages;
}

function initVideoPane() {
    videoPane.classList.remove("d-none");
    questionsForm.classList.add("d-none");
    video.src = config.video.filename;

    playButton.innerHTML = config.config.general.labels.play;
    replayButton.innerHTML = config.config.general.labels.replay;

    prevBtn.innerHTML = config.config.general.labels.previous;
    nextBtn.innerHTML = config.config.general.labels.next;
    submitBtn.innerHTML = config.config.general.labels.submit;

    if (!config.config.general.ui.showReplayButton) replayButton.style.display = "none";
    if (!config.config.general.ui.showPreviousButton) prevBtn.style.display = "none";

    videoPane.querySelector("#video-container").style.width = config.config.general.ui.videoWidth + "%";
    videoPane.querySelector("#survey-container").style.width = (100 - config.config.general.ui.videoWidth) + "%";

    addSurvey();
}

function finishVideoPane() {
    videoPane.classList.add("d-none");
}

playButton.addEventListener("click", function () {
    playPauseVideo();
});

const playPauseVideo = async () => {
    playButton.classList.add('d-none');
    questionsForm.classList.add('d-none');
    videoFrame.currentTime = config.video.breakpoints[config.video.currentSegment];
    await videoFrame.play();
    await wait(config.config.general.timing.interval * 1000);
    console.log("Waited " + config.config.general.timing.interval + " s. The video is now at " + videoFrame.currentTime + " s.");
    videoFrame.pause();
    replayButton.classList.remove('d-none');
    startSurvey();
}

function wait(timeout) {
    return new Promise(resolve => {
        setTimeout(resolve, timeout);
    });
}

const replayVideo = async() => {
    currentSegment = config.video.currentSegment
    videoFrame.currentTime = config.video.breakpoints[currentSegment];
    await videoFrame.play();
    await wait(config.config.general.timing.interval * 1000);
    if (currentSegment == config.video.currentSegment) { // Only pause if the video was not continued after submitting answers
        console.log("Waited " + config.config.general.timing.interval + " s. The video is now at " + videoFrame.currentTime + " s.");
        videoFrame.pause();
    }
}

replayButton.addEventListener("click", function() {
    replayVideo();
});

// == Question pages
let step = document.getElementsByClassName('step');
let prevBtn = document.getElementById('prev-btn');
let nextBtn = document.getElementById('next-btn');
let submitBtn = document.getElementById('submit-btn');
let bodyElement = document.querySelector('body');

let current_step = 0;
let stepCount = 0;

function startSurvey() {
    questionsForm.classList.remove('d-none');
    questionsForm.classList.remove("was-validated");
    current_step = 0;
    stepCount = step.length - 1
    step[current_step].classList.remove('d-none');
    step[current_step].classList.add('d-block');
    prevBtn.classList.add('disabled');
    if (stepCount > 0) {
        submitBtn.classList.add('invisible');
        submitBtn.classList.remove('visible');
        nextBtn.classList.remove('disabled');
    } else {
        submitBtn.classList.add('visible');
        submitBtn.classList.remove('invisible');
        nextBtn.classList.add('disabled');
    }

    questionsForm.reset();
}

function finishSurvey() {
    replayButton.classList.add('d-none');

    config.video.currentSegment += 1;
    if (config.video.currentSegment > config.video.breakpoints.length - 2) {
        finishVideoPane();
        initOutroPane();
        return;
    }
    playPauseVideo();
}

function checkQuestionsFormCurrentStep() {
    questionsForm.classList.remove("was-validated");
    setRequired(questionsForm, false);
    setRequired(step[current_step], true);
    if (questionsForm.checkValidity()) {
        return true;
    }
    questionsForm.classList.add("was-validated");
    return false;
}

nextBtn.addEventListener('click', () => {
    if (!checkQuestionsFormCurrentStep()) {
        return;
    }
    current_step++;
    let previous_step = current_step - 1;
    if ((current_step > 0) && (current_step <= stepCount)) {
        prevBtn.classList.remove('disabled');
        step[current_step].classList.remove('d-none');
        step[current_step].classList.add('d-block');
        step[previous_step].classList.remove('d-block');
        step[previous_step].classList.add('d-none');
        if (current_step == stepCount) {
            submitBtn.classList.add('visible');
            submitBtn.classList.remove('invisible');
            nextBtn.classList.add('disabled');
        }
    }
});

prevBtn.addEventListener('click', () => {
    if (current_step > 0) {
        current_step--;
        let previous_step = current_step + 1;
        prevBtn.classList.add('disabled');
        step[current_step].classList.remove('d-none');
        step[current_step].classList.add('d-block')
        step[previous_step].classList.remove('d-block');
        step[previous_step].classList.add('d-none');
        if (current_step < stepCount) {
            submitBtn.classList.add('invisible');
            submitBtn.classList.remove('visible');
            nextBtn.classList.remove('disabled');
            prevBtn.classList.remove('disabled');
        }
    }

    if (current_step == 0) {
        prevBtn.classList.add('disabled');
    }
});

questionsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();

    setRequired(questionsForm, true);

    if (questionsForm.checkValidity()) {

        questionsForm.classList.add('d-none');
        step[stepCount].classList.remove('d-block');
        step[stepCount].classList.add('d-none');
        prevBtn.classList.add('disabled');
        submitBtn.classList.add('invisible');
        submitBtn.classList.remove('visible');

        writeCsvData();
        finishSurvey();
    }
    questionsForm.classList.add("was-validated");
});

questionsForm.addEventListener('reset', (event) => {
    // Reset all range sliders
    questionsForm.querySelectorAll('input[type=range]').forEach(function(item) { item.classList.add("range-thumb-hide") });
    questionsForm.querySelectorAll('input[type=range]').forEach(function(item) { item.previousSibling.previousSibling.innerHTML = "&nbsp;" });
});

// == Outro pane ==
const outroText = document.querySelector("#outroText");

function initOutroPane() {
    outroPane.classList.remove("d-none");

    regex = /(?:\r\n|\r|\n)/g;
    outroText.innerHTML = "<h1>" + config.config.outro.title + "</h1><p>" + config.config.outro.text.replaceAll(regex, '<br/>') + "</p>";
}

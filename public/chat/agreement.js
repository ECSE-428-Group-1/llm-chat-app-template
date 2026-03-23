/**
 * Agreement modal and cookie management
 */

import { dom } from "./dom.js";

function hasAgreed() {
    return document.cookie.split(";").some((item) => item.trim().startsWith("nasaq_agreed="));
}

export function setupAgreementModal() {
    if (!dom.modal || !dom.agreeBtn) return;

    /* commenting the cookies part to pass tests.*/
    if (hasAgreed()) {
        dom.modal.style.display = "none";
        dom.mainContent?.classList.remove("locked");
        dom.inputArea?.classList.remove("locked");
        dom.userInput.disabled = false;
        dom.sendButton.disabled = false;
    } else {
        /**/
        dom.modal.style.display = "flex";
        dom.mainContent?.classList.add("locked");
        dom.inputArea?.classList.add("locked");
        dom.userInput.disabled = true;
        dom.sendButton.disabled = true;
        dom.userInput.placeholder = "Please accept the agreement to chat...";
    } //cookies

    dom.agreeBtn.addEventListener("click", () => {
        /* commenting the cookies part to pass tests.*/
        const d = new Date();
        d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000);
        document.cookie = "nasaq_agreed=true; expires=" + d.toUTCString() + "; path=/";
        /**/
        dom.modal.style.display = "none";
        dom.mainContent?.classList.remove("locked");
        dom.inputArea?.classList.remove("locked");
        dom.userInput.disabled = false;
        dom.sendButton.disabled = false;
        dom.userInput.placeholder = "Please Enter Your Prompt Here";
    });

    dom.declineBtn.addEventListener("click", () => {
        if (dom.errorMsg) dom.errorMsg.style.display = "block";
    });

    dom.readBtn.addEventListener("click", () => {
        const isOpeningPDF = dom.pdfContainer.style.display === "none";
        if (isOpeningPDF) {
            dom.pdfContainer.style.display = "block";
            dom.modalContent.classList.add("expanded");
            dom.readBtn.innerText = "Back to Message";
        } else {
            dom.pdfContainer.style.display = "none";
            dom.modalContent.classList.remove("expanded");
            dom.readBtn.innerText = "Read Policy";
        }
    });
}

export function checkAgreement() {
    if (!hasAgreed()) {
        alert("You must accept the agreement to use NASAQ ChatBot.");
        location.reload();
        return false;
    }
    return true;
}

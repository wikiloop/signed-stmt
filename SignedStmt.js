// Schema 
/**
 * key -> value
 * 
 * addEndorsement(subject, revId, idType, identifier, content, signature, timestamp)
 * [subject-revId]: {
 *   [idType-identifier]: {
 *      content: string, // MUST include revid, idType:identifier and timestamp
 *      signature: string, 
 *      timestamp: number,
 *   }
 * }
 * 
 * loadEndorsements(subject-revId)
 * returns {
 *      [idType:identifier]: {
 *          content: string, // MUST include revid, idType:identifier and timestamp
 *          signature: string,
 *          timestamp: number,
 *      }
 * }
 * 
 * 
 */
async function addEndorsement(subject, revId, idType, identifier, content, signature, timestamp) {
    const key = `${subject}-${revId}`;
    const value = {
        [`${idType}-${identifier}`]: {
            content,
            signature,
            timestamp,
        }
    }
    let currentEndorsements = JSON.parse(window.localStorage.getItem(key));
    if (!currentEndorsements) {
        currentEndorsements = { }
    }
    currentEndorsements[`${idType}-${identifier}`] = {
        content,
        signature,
        timestamp,
    };

    window.localStorage.setItem(key, JSON.stringify(currentEndorsements));
}

async function loadEndorsements(subject, revId) {
    const key = `${subject}-${revId}`;
    let currentEndorsements = JSON.parse(window.localStorage.getItem(key));
    if (!currentEndorsements) {
        currentEndorsements = { }
    }
    return currentEndorsements;
}

async function validate(endorsement) {
    const normalizedMsg = JSON.parse(endorsement.content);
    const signer = normalizedMsg.sigMeta.signer;
    const recoveredAccount = await ethereum.request({
        method: 'personal_ecRecover',
        params: [endorsement.content, endorsement.signature]
    });
    console.log("signer", signer);
    console.log("recoveredAccount", recoveredAccount);
    return recoveredAccount.toLowerCase() === signer.toLowerCase();
}

function xblAddButtons() {
    $('*[data-xbl="true"]').remove();
    // parsing "Q42" from the following URL
    // https://www.wikidata.org/w/index.php?title=Q42&action=history
    const subject = extractTitle(window.location.href);

    $("section > ul > li").filter(function () {
        return $(this).data("mwRevid");
    }).map(async function () {
  
        const revId = $(this).data("mwRevid");
        $(`<div 
            style='display: inline-block; 
                padding: 4px 4px; 
                margin-right: 8px; 
                border: 1px solid #ccc; 
                border-radius: 4px; 
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1); 
                text-align: center; 
                font-weight: bold; 
                cursor: pointer;'
            onclick='xblHandleEndorse(event)'
            data-xbl="true"
            data-mw-revid='${revId}'>Endorse!</div>`)
        .insertBefore($("span.mw-history-histlinks.mw-changeslist-links", this));

        // get endorsements
        let currentEndorsements = await loadEndorsements(subject, revId);
        console.log(`currentEndorsements for ${revId} =`, currentEndorsements);
        
        // if there are endorsements, add a verify button
        if (Object.keys(currentEndorsements).length > 0) {
            for (let key of Object.keys(currentEndorsements)) {
                let endorsement = currentEndorsements[key];
                if (await validate(endorsement)) {
                    console.log("valid endorsement", endorsement);
                    $(`<div 
                    style='display: inline-block;'
                    data-xbl="true"
                    data-mw-revid='${revId}'>
                    <img 
                        style='width: 20px; height: 20px; margin: 4px;'
                         src="https://img.icons8.com/ios/50/12AB1D/verified-account.png" alt="checkmark"/>
                    </div>`)
                    .insertAfter($("span.mw-history-histlinks.mw-changeslist-links", this));
                } else {
                    console.log("inValid endorsement", endorsement);
                    $(`<div 
                    style='display: inline-block;'
                    data-xbl="true"
                    data-mw-revid='${revId}'>
                    <img 
                        style='width: 20px; height: 20px; margin: 4px;'
                         src="https://img.icons8.com/ios/50/FCC419/verified-account.png" alt="checkmark"/>
                    </div>`)
                    .insertAfter($("span.mw-history-histlinks.mw-changeslist-links", this));    
                }

            }

        }
    });

}

function extractTitle(url) {
    // Create a URL object
    const parsedUrl = new URL(url);

    // Get the value of the "title" parameter
    const title = parsedUrl.searchParams.get("title");

    console.log(title);
    return title;
}

async function xblHandleEndorse(event) {
    const subject = extractTitle(window.location.href);

    event.preventDefault();
    var revid = event.target.getAttribute("data-mw-revid");
    let signerAddress = (await ethereum.request(
        {
            method: 'eth_requestAccounts'
        }
    ))[0];

    const sigMeta = {
        signer: signerAddress.toLowerCase(),
        timestamp: new Date().getTime(),
    }

    const content = {
        revid,
    }

    const msg = {
        sigMeta,
        content
    }

    var normalizedMsgStr = JSON.stringify(msg, null, 2);

    const storeageId = revid;

    let sig = await ethereum.request({
        method: 'personal_sign',
        params: [
            // message to sign
            normalizedMsgStr,
            signerAddress
        ]});
    let recoveredAddress = 
    await ethereum.request({
        method: 'personal_ecRecover',
        params: [
            // message to sign
            normalizedMsgStr,
            sig
        ]});
    const valueToSave = {
        sig,
        // convert to base64
        normalizedMsgStrBase64: btoa(normalizedMsgStr),
    }
    await addEndorsement(subject, revid, "eth", signerAddress, normalizedMsgStr, sig, sigMeta.timestamp);
    xblAddButtons();
}

async function xblHandleVerify(event) {
    const revid = event.target.getAttribute("data-mw-revid");
    const storeageId = revid;
    data = await load(revid);
    const sig = data.sig
    const normalizedMsgStr = atob(data.normalizedMsgStrBase64);
    let recoveredAccount = await ethereum.request({
        method: 'personal_ecRecover',
        params: [
            // message to sign
            normalizedMsgStr,
            sig
        ]});
    msg = JSON.parse(normalizedMsgStr);
    console.log(`Returned account =`, recoveredAccount);
    console.log(`Declared endorser was`, msg.sigMeta.signer);
    if (recoveredAccount.toLowerCase() === msg.sigMeta.signer.toLowerCase()) {
        console.log(`Signature verified!`);
    }
}

async function save(key, value) {
    localStorage.setItem(key, value);
}

async function load(key) {
    let value = localStorage.getItem(key);
    let parsedValue = JSON.parse(value);
    return parsedValue;
}

async function main() {
    xblAddButtons();
}

$(document).ready(async function () {
    await main();
    console.log(`Done loading SignedStmt`);
});

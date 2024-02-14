function showAlert(message, isFailed = false, autoRemove = !isFailed) {
    message ??= isFailed ? "실패 실험중..." : "성공 실험중...";
    // 문자열 변경
    var alertHtml = `<div id="alert-${isFailed ? 'failure' : 'success'}" class="toast align-items-center text-white bg-${isFailed ? 'danger' : 'success'} hide" role="alert"
    aria-live="assertive" aria-atomic="true">
    <div class="col d-flex align-items-center justify-content-between">
        <svg class="bi flex-shrink-0 me-2" width="24" height="24" role="img" aria-label="${isFailed ? 'Failure:' : 'Success:'}">
            <use xlink:href="#${isFailed ? 'exclamation-triangle-fill' : 'check-circle-fill'}" />
        </svg>
        <div class="toast-body text-center">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"
            aria-label="Close"></button>
    </div>
    </div>`;

    // alert 추가
    $(".alert-container").append(alertHtml);

    // Toast 표시
    $(".alert-container #alert-" + (isFailed ? 'failure' : 'success')).toast({
        autohide: autoRemove
    }).toast("show");

    if (autoRemove) {
        $(".alert-container #alert-" + (isFailed ? 'failure' : 'success')).on('hidden.bs.toast', function () {
            $(this).remove();
        });
    }
}
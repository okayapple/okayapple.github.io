(function() {
    var overlay = document.getElementById('tables-overlay');
    var body = document.getElementById('tables-overlay-body');
    var toggle = document.getElementById('tables-overlay-toggle');
    var frame = document.querySelector('.tables-overlay__frame');

    if (toggle && body && overlay) {
        toggle.addEventListener('click', function() {
            var collapsed = overlay.classList.toggle('tables-overlay--collapsed');
            body.hidden = collapsed;
            toggle.textContent = collapsed ? 'Развернуть' : 'Свернуть';
            toggle.setAttribute('aria-expanded', String(!collapsed));
        });
    }

    var bottomLeft = document.getElementById('bottom-left-container');
    if (bottomLeft) {
        bottomLeft.style.display = 'none';
    }

    function resizeFrame() {
        if (!frame || !frame.contentWindow || !frame.contentWindow.document) {
            return;
        }
        var doc = frame.contentWindow.document;
        var html = doc.documentElement;
        var bodyEl = doc.body;
        var nextHeight = Math.max(
            bodyEl ? bodyEl.scrollHeight : 0,
            html ? html.scrollHeight : 0
        );
        if (nextHeight > 0) {
            frame.style.height = nextHeight + 'px';
        }
    }

    if (frame) {
        frame.addEventListener('load', function() {
            resizeFrame();
            setTimeout(resizeFrame, 150);
        });
        window.addEventListener('resize', resizeFrame);
    }
})();

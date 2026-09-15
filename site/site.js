/* Site interactions: mobile menu + copy-to-clipboard. Vanilla JS, no deps. */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  initMenu();
  initCopyButtons();

  function initMenu() {
    var btn = document.querySelector('.menu-btn');
    var nav = document.getElementById('site-nav');
    if (!btn || !nav) return;
    function setOpen(open) {
      document.documentElement.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) {
        var first = nav.querySelector('a');
        if (first) first.focus();
      }
    }
    btn.addEventListener('click', function () {
      setOpen(!document.documentElement.classList.contains('menu-open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        setOpen(false);
        btn.focus();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) {
        setOpen(false);
        btn.focus();
      }
    });
  }

  function initCopyButtons() {
    document.querySelectorAll('[data-copy-target]').forEach(function (btn) {
      var pending = false;
      btn.addEventListener('click', function () {
        if (pending) return;
        var el = document.getElementById(btn.getAttribute('data-copy-target'));
        if (!el) return;
        copyText(el.textContent, function (ok) {
          announce(ok ? 'Copied!' : 'Copy failed — select the text manually');
          if (!ok) return;
          pending = true;
          var label = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function () {
            btn.textContent = label;
            pending = false;
          }, 1500);
        });
      });
    });
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          done(true);
        },
        function () {
          fallbackCopy(text, done);
        }
      );
      return;
    }
    fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('aria-hidden', 'true');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    done(ok);
  }

  function announce(message) {
    var region = document.getElementById('copy-status');
    if (!region) {
      region = document.createElement('div');
      region.id = 'copy-status';
      region.className = 'visually-hidden';
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    region.textContent = '';
    window.setTimeout(function () {
      region.textContent = message;
    }, 30);
  }
})();

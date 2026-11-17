// Any unmatched path is the SPA root — preserve the full query string
// (required for /verify?token=... and other parameterized routes).
location.replace("/?p=" + encodeURIComponent(location.pathname) + location.search);

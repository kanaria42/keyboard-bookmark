new Vue({
  el: '#app',
  data: {
    proxyUrl: '',
    dispMax: 3,
    selected: null,
    searchword: null,
    dispBookmarks: [],
    currentProcessId: null
  },
  methods: {
    init: function() {
      this.dispBookmarks = [];
      chrome.bookmarks.getRecent(this.dispMax, (bookmarks) => {
        bookmarks.forEach(bookmark => this.setBookmark(bookmark));
        this.selected = bookmarks.length > 0 ? 0 : null;
        this.$refs.searchword.focus();
      });
    },
    input: function(e) {
      this.searchword = e.target.value;
      if (this.searchword == null || this.searchword === '') {
        this.init();
        return;
      }
      this.search();
    },
    search: function() {
      chrome.bookmarks.search(this.searchword, (bookmarks) => {
        const _bookmarks = bookmarks.filter(s => s.url).slice(0, this.dispMax);
        if (this.isEqual(_bookmarks)) {
          return;
        }
        this.clear();
        _bookmarks.slice(0, this.dispMax).forEach(bookmark => {
          this.setBookmark(bookmark);
        })
        this.selected = _bookmarks.length > 0 ? 0 : null;
      });
    },
    submit: function() {
      if (this.selected > this.dispBookmarks.length) {
        return;
      }
      const windowId = decodeURIComponent(location.search.replace(/^\?id=/, ''));
      chrome.tabs.create({ windowId: +windowId, url: this.dispBookmarks[this.selected].url }, () => {
        chrome.windows.getCurrent({}, window => chrome.windows.remove(window.id));
      });
    },
    isEqual: function(bookmarks) {
      if (bookmarks.length !== this.dispBookmarks.length) {
        return false;
      }
      for (let i = 0; i < bookmarks.length; i++) {
        if (bookmarks[i].id !== this.dispBookmarks[i].id) {
          return false;
        }
      }
      return true;
    },
    setBookmark: function(bookmark) {
      this.getCache(bookmark.url, () => {
        this.dispBookmarks.push({
          id: bookmark.id,
          site_name: null,
          title: bookmark.title,
          url: bookmark.url,
          image: null,
          description: null
        });
        this.setOgp(bookmark);
      });
    },
    setOgp: function(bookmark) {
      const processId = this.currentProcessId;
      this.getOgp(bookmark.url).then(ogp => {
        const ogpParam = {
          site_name: this.coalesce(ogp, bookmark, 'site_name'),
          image: this.addurl(this.coalesce(ogp, bookmark, 'image')),
          description: this.coalesce(ogp, bookmark, 'description')
        };
        const data = {...bookmark, ...ogpParam};
        this.setCache(bookmark.url, data);
        let idx = this.dispBookmarks.findIndex(b => b.id === bookmark.id);
        if (processId === this.currentProcessId) {
          this.$set(this.dispBookmarks, idx, data);
        }
      });
    },
    getOgp: async function(url) {
      try {
        const result = await fetch(this.proxyUrl + url);
        const text = await result.text();
        const dom = new DOMParser().parseFromString(text, "text/html");
        return Array.from(dom.head.children)
            .filter(h => /^og.*/.test(h.getAttribute('property')))
            .flatMap(v => [{[v.getAttribute("property").replace('og:', '')]: v.getAttribute("content")}])
            .reduce((accumulator, v) => Object.assign(accumulator, v))
      } catch {
        return null;
      }
    },
    addurl: function(url) {
      if (!url) {
        return null;
      }
      return /^http?.*/.test(url) ? url : 'https:' + url;
    },
    coalesce: function(arg1, arg2, prop) {
      if (arg1 == null || arg2 == null) {
        return (arg1 ?? arg2 ?? {})[prop];
      }
      return arg1[prop] ?? arg2[prop];
    },
    clear: function() {
      this.currentProcessId = Math.random();
      this.dispBookmarks = [];
    },
    setCache: function(url, data) {
      chrome.storage.local.set({[url]: JSON.stringify(data)}, () => {});
    },
    getCache: function(url, orElseGet) {
      const processId = this.currentProcessId;
      chrome.storage.local.get([url], (result) => {
        if (processId && processId !== this.currentProcessId) {
          return;
        }
        if (result[url] && result[url].length > 0) {
          this.dispBookmarks.push(JSON.parse(result[url]));
          return;
        }
        orElseGet();
      });
    },
    moveup: function() {
      this.selected = !this.selected ? this.dispBookmarks.length - 1 : this.selected - 1;
    },
    movedown: function() {
      this.selected = this.selected == null || this.selected >= this.dispBookmarks.length - 1 ? 0 : this.selected + 1;
    }
  },
  mounted() {
    this.init();
  },
});
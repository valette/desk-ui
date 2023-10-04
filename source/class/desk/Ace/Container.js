
/**
 * @asset(desk/workers/worker-javascript.js)
 * @asset(desk/workers/worker-html.js)
 * @asset(desk/workers/worker-json.js)
*/

/**
 * Container for the ACE source code editor.
 */

qx.Class.define("desk.Ace.Container", {

	extend : qx.ui.core.Widget,

	/**
	* Constructor.
	*/
	construct : function() {

		this.base(arguments);
		this.addListener('appear', this.__onAppear, this);
		if ( window.ace ) return;
		const manager = qx.util.ResourceManager.getInstance();
		const ace = window.ace = require('ace-builds/src-noconflict/ace');
		require('ace-builds/src-noconflict/mode-c_cpp');
		require('ace-builds/src-noconflict/mode-html');
		require('ace-builds/src-noconflict/mode-javascript');
		require('ace-builds/src-noconflict/mode-json');
		require('ace-builds/src-noconflict/mode-python');
		require('ace-builds/src-noconflict/theme-eclipse');
		require('ace-builds/src-noconflict/ext-searchbox');
		require("ace-builds/src-noconflict/ext-language_tools");
		ace.config.setModuleUrl( "ace/mode/javascript_worker", manager.toUri( "desk/workers/worker-javascript.js") );
		ace.config.setModuleUrl( "ace/mode/json_worker", manager.toUri( "desk/workers/worker-json.js") );
		ace.config.setModuleUrl( "ace/mode/html_worker", manager.toUri( "desk/workers/worker-html.js") );

	},

	members : {
		/**
		 * Sets the language mode
		 * @param mode{String} mode : "javascript" or "c_cpp"
		 */
		setMode : function (mode) {
            this.__mode = mode;
		},

		/**
		 * callback launched when the container appears on screen
		 */
		__onAppear : function() {

			const element = this.getContentElement().getDomElement();
			var editor = this.__ace = window.ace.edit( element );
			editor.$blockScrolling = Infinity;
			editor.session.on('changeMode', function(e, session){
				if ("ace/mode/javascript" === session.getMode().$id) {
					if (!!session.$worker) {
						session.$worker.send("setOptions", [{
							esversion: 11,
							esnext: false,
							globalstrict: true,
							browser: true,
							globals : {
								"console" : true
							}
						}]);
					}
				}
			});

			this.addListener( "resize", this.__onResize, this );

			if (this.__mode)
				this.__ace.getSession().setMode('ace/mode/' + this.__mode);

			this.setFontSize( 15 );
			editor.resize();

		},

		__mode : null,
		__ace : null,

		/**
		* Returns the underlying ACE object
		* @return {Object} the ace editor
		*/
		getAce: function() {
			return this.__ace;
		},

		/**
		 * callback launched when the container is resized
		 */
		__onResize : function () {
			setTimeout(this.__ace.resize.bind(this.__ace), 0);
		},

		/**
		* Returns the current set code of the editor.
		* @return {String} The current set text.
		*/
		getCode : function() {
			return this.__ace.getSession().getValue();
		},

		/**
		* Sets the given code to the editor.
		* @param code {String} The new code.
		*/
		setCode : function( code ) {
		    if ( !this.__ace || !this.__ace.getSession ) {
		        // wait if the container is not ready
		        setTimeout( function ( ) {
		            this.setCode( code );
		        }.bind( this ), 10 );
		        return;
		    }
			this.__ace.getSession().setValue(code);

			// move cursor to start to prevent scrolling to the bottom
			this.__ace.renderer.scrollToX(0);
			this.__ace.renderer.scrollToY(0);
			this.__ace.selection.moveCursorFileStart();
		},

		/**
		* Sets the editor font size.
		* @param size {Number} new font size
		*/
		setFontSize : function (size) {
			this.__ace.setFontSize(size);
		}
	},

	destruct : function() {
		this.__ace.destroy();
		this.__ace = null;
	}
});

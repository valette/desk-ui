/**
 * Mixin for handling embedding windows
 */
qx.Mixin.define("desk.WindowMixin",
{
	construct : function () {
		var minSize = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.85);

		var win = new qx.ui.window.Window();
		win.set({layout : new qx.ui.layout.HBox(), showMinimize : false,
			width : minSize, height : minSize});

        win.add(this, {flex : 1});
        win.open();
		win.center();
		this.__window = win;

		win.addListener('close', function() {
			this.fireEvent("close")
			this.dispose();
			win.destroy();
		}, this);

	},

	members : {
		__window : null,

		/**
		 * Returns the container window
		 * @return {qx.ui.window.Window} the container window
		 */
		getWindow : function () {
			return (this.__window);
		},

		/**
		 * Overlays the window content to fill the whole screen.
		 */
		fillScreen : function () {
			var container = this.__window.getChildrenContainer();
			container.set ( {
				backgroundColor : "white",
				zIndex : 500000
			} );
			qx.core.Init.getApplication().getRoot().add( container,
				{ width : '100%', height : '100%' } );
		},

		/**
		 * closes the window
		 */
		close : function () {
			this.__window.close();
		}
	}
});

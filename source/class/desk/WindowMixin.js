/**
 * Mixin for handling embedding windows
 */
qx.Mixin.define("desk.WindowMixin",
{
	construct : function () {

		const win = new qx.ui.window.Window();
		win.set( { layout : new qx.ui.layout.HBox(), showMinimize : false } );

		if ( !this.getHeight() || !this.getWidth() ) {

			const minSize = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.85);
			win.set({ width : minSize, height : minSize});

		}

        win.add(this, {flex : 1});
        win.open();
		win.center();
		this.__window = win;

		win.addListener('close', function() {
			this.fireEvent("close")
			this.dispose();
			win.destroy();
		}, this);

		const container = new qx.ui.container.Composite( new qx.ui.layout.HBox() );
		win.getChildControl( "captionbar" ).add( container, { row: 0, column : 2 } );
		const halfFills = {	left: [ 0, 0 ],	right: [ 1, 0 ]	};

		Object.entries( halfFills ).forEach( entry => {

			const [ name, position ] = entry;
			const button = new qx.ui.form.Button( name[ 0 ].toUpperCase() );
			button.setFocusable(false);
			button.setDecorator( "window-caption" );
			button.setToolTipText( "fill " + name + " part of screen");
			container.add( button );

			button.addListener("execute", () => {

				const height = window.innerHeight;
				const halfWidth = Math.round( 0.5 * window.innerWidth );
				win.set( {width : halfWidth, height });
				win.moveTo( ...position.map( p => p * halfWidth ) );

			} );

		} );

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
				zIndex : 100000
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

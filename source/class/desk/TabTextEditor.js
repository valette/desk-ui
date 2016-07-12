/**
 * A text editor that can also execute javascript code
 * @lint ignoreDeprecated (alert)
 */
qx.Class.define("desk.TabTextEditor",
{
	extend : qx.core.Object,
	type : "singleton",

	/**
	* Creates a new text editor
	*
	* @param file {String} the file to edit
	*/
	construct : function() {
	    this.base(arguments);
	},

	statics : {

		/**
		* Creates a new text editor
		* @param file {String} the file to edit
		*/
		open : function(file) {
			var win = desk.TabTextEditor.getInstance().__window;
			if (!win) {
				win = desk.TabTextEditor.getInstance().__window = new qx.ui.window.Window();
				win.set( { layout : new qx.ui.layout.VBox(),
					height : 700, width : 700, showMinimize : false } );
				win.addListener( 'close', function () {
					var instance = desk.TabTextEditor.getInstance();
					instance.__window.getChildren()[0].getChildren().forEach( function (e) {
						e.destroy();
					});
					instance.__window.destroy();
					instance.__window = 0;
				});
				win.setCaption( "Desk Text Editor" );
				win.add( new desk.TabView(), { flex : 1 } );
				win.open();
				win.center();
			}

			var found = false;
			win.getChildren()[0].getChildren().forEach(function (e) {
				if (e.getLabel() === file) {
					found = true;
					e.getButton().execute();
				}
			});

			win.getLayoutParent().getWindowManager().bringToFront(win); 
			if (found) return;

			var editor = new desk.TextEditor(file, {standalone : false});
			var element = win.getChildren()[0].addElement(file,editor);
			element.getButton().execute();
			element.setShowCloseButton(true);
			element.show();
			element.addListener('close', editor.destroy, editor);
		}

	},

	members : {
        __window : null
	}
});

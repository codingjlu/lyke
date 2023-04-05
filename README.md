# lyke
Lyke is a fast and simple build tool that bundles HTML, along with a couple extras. No extra code is added to your build, it just bundles your code. It currently only supports a single page as output, but more features are planned.

<s>This is actually a tiny side project I made to support the creation of a random landing page.</s>

### Usage
Install with `npm i lyke`, then create a file `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>lyke</title>
</head>
<body>
  {{app/root}}
</body>
</html>
```
In `app/root.html`, add the following:
```html
<h1>Hello, world!</h1>
```
Now start the development server by running:
```shell
lyke dev index.html # or npx lyke dev index.html
```
Then navigate to [`http://localhost:3000`](https://localhost:3000) and you should see the compiled HTML. As of now, saving a file will refresh the page so you don't have to do it manually, with HMR capabilities being implemented in the future.

You can also create JS and CSS snippets simply by using the `script` and `style` tags in any file, respectively. These get bundles into separate files and linked in your HTML file automatically.

For image files and the like, create a folder at the root of your project called `assets/`. This folder will automatically get copied into your build file.

To create a production build, simply run `lyke build index.html`, which by default will output your files into the `dist/` directory.

### Config
You can specify a JSON config file by passing the command line argument `--config` (or `-c` for short).

Here are the currently supported customizations:
```json
{
  "output": {
    "html": "index.html",
    "css": "styles.css",
    "js": "scripts.js",
    "dir": "dist",
    "assets": "assets"
  },
  "assets": "assets",
  "devServer": {
    "port": 3000
  }
}

```

### License
MIT

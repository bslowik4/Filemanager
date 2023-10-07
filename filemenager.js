const express = require("express")
const app = express()
const PORT = 5000;
const path = require("path")
app.use(express.static('static'))
const fs = require('fs');
const formidable = require('formidable');
const hbs = require('express-handlebars');
const fileInside = require("./static/filetypes.json");
let users = require("./static/users.json")
const { request } = require("http");
const settings = require("./static/settings.json")
const bodyParser = require("body-parser")
const cookieparser = require("cookie-parser");
const nocache = require("nocache");
const { json } = require("express");
app.use(express.json());
app.use(nocache())
app.use(cookieparser())
app.use(bodyParser.urlencoded({ extended: true }));
let username;
let context = {

};
app.set('views', path.join(__dirname, 'views'));
app.engine('hbs', hbs({
    defaultLayout: 'main.hbs',
    helpers: {
        image: (name) => {
            let test = name.split('.')
            if (test[1] == "png") {
                return "/icons/png.png"
            }
            else if (test[1] == "txt") {
                return "/icons/txt.png"
            }
            else if (test[1] === undefined) {
                return "/icons/html.png"
            }
            else {
                return "/icons/html.png"
            }
        },
        line: (number) => { return number }
    },
    extname: '.hbs',
    partialsDir: "views/partials",
}));
app.set('view engine', 'hbs');


app.get("/", function (req, res) {
    res.render('register.hbs')
})

app.post("/register", (req, res) => {
    let registerProper = true;
    let login = req.body.name;
    let password = req.body.pass;
    (req.body.passConfirm != password) ? registerProper = false : registerProper = true;
    users.logins.forEach(element => {
        if (req.body.name == element) { registerProper = false; console.log("teraz"); };
    });
    if (!registerProper) res.render('error.hbs')
    else {
        let newUser = {}
        newUser[login] = password
        Object.assign(users, newUser)
        users.logins.push(login)
        fs.writeFileSync("./static/users.json", JSON.stringify(users))

        const filepath = path.join(__dirname, "upload", req.body.name)
        fs.mkdir(filepath, (err) => {
            if (err) throw err
            console.log("jest");
        })
        res.redirect("/login")
    }
})

app.get("/register", (req, res) => {
    res.render('register.hbs')
})

app.get("/login", (req, res) => {
    res.render("login.hbs")
})

app.post("/checkCredits", (req, res) => {
    let login = req.body.name;
    username = req.body.name
    let password = req.body.pass;
    if (!(users.logins.includes(login))) res.render("error.hbs")
    if (users[login] == password) { res.cookie("login", login, { httpOnly: true, maxAge: 30 * 1000 }); res.redirect("/filemanager?root=upload") }
    else res.render("error.hbs")
})

app.get("/logout", (req, res) => {
    res.clearCookie("login");
    res.redirect("/login");
})


app.post("/filemanager", function (req, res) {


    let form = formidable({});

    form.uploadDir = path.join(__dirname)
    form.keepExtensions = true
    form.multiples = true

    form.on('fileBegin', function (name, file) {
        file.path = form.uploadDir + "/" + context.root + "/" + file.name;
    })

    form.parse(req, function (err, fields, files) {
    });


    res.redirect(`/filemanager?root=${context.root}`)

})




app.get("/filemanager", (req, res) => {
    if (req.cookies.login === undefined) res.redirect("/login")
    let filesS = []
    let folders = []
    let pathArray = []
    let tempRootDisplay = []
    let rootPath = path.join(__dirname, "upload")
    if (req.query.root !== undefined && !req.query.root !== " ") {
        tempRootDisplay = req.query.root.split("/")
        rootPath = path.join(__dirname, req.query.root)
    }

    tempRootDisplay[0] = "upload"
    tempRootDisplay.forEach((element, i) => {
        pathArray.push({ path: tempRootDisplay.slice(0, i + 1).join("/"), view: element })
    });
    let promise = new Promise((resolve) => {
        fs.readdir(rootPath, (err, files) => {
            if (err) throw err
            files.forEach((file) => {
                fs.lstat(path.join(rootPath, file), (err, stats) => {
                    if (stats.isDirectory()) {
                        folders.push({ name: file, currentFolder: req.query.root })
                    }
                    else {
                        filesS.push({ name: file, currentFolder: req.query.root })
                    }
                })
            })
        })
        resolve(context = {
            username: username,
            names: filesS,
            folderNames: folders,
            root: req.query.root,
            pathDisplay: pathArray
        })
    })
    promise.then(console.log(context))
        .then(
            res.render('filemanager.hbs', context)
        )
})


app.get("/download", (req, res) => {
    let work = req.query.path.split('\\')
    let filename = work.at(-1)
    res.download(__dirname + `/static/upload/${filename}`, `${filename}`);
})


app.get("/savefile", (req, res) => {
    const filepath = path.join(__dirname, req.query.root, req.query.name)
    if (fs.existsSync(filepath)) {
        let final;
        let name = req.query.name.split(".")
        if (name[1] === undefined) final = name + " copy"
        else final = name[0] + " copy." + name.at(-1)
        res.redirect(`/savefile/?root=${req.query.root}&name=${final}`)
    }
    else {
        let insider = "działa";
        Object.keys(fileInside).forEach(element => {
            if (req.query.name.split(".").at(-1) == element) {
                insider = fileInside[element]
            }
        });
        fs.writeFile(filepath, insider, (err) => {
            if (err) throw err
        })
    }

    res.redirect(`/filemanager?root=${req.query.root}`)
})

app.get("/savefolder", (req, res) => {
    console.log(req.query);
    const filepath = path.join(__dirname, req.query.root, req.query.name)
    if (fs.existsSync(filepath)) {
        res.redirect(`/savefolder/?root=${req.query.root}&name=${req.query.name} copy`)
    }
    else {
        fs.mkdir(filepath, (err) => {
            if (err) throw err
        })
    }
    res.redirect(`/filemanager?root=${req.query.root}`)
})

app.get("/delete", (req, res) => {
    let deletePath = path.join(__dirname, req.query.id)
    if (fs.existsSync(deletePath)) {
        fs.lstat(deletePath, (err, stats) => {
            if (stats.isDirectory()) {
                fs.rmdir(deletePath, (err) => {
                    //if (err) throw err
                })
            }
            else {
                fs.unlink(deletePath, (err) => {
                    //if (err) throw err
                })
            }
        })
    }
    res.redirect(`/filemanager?root=${req.query.root}`)
})

app.get("/dirRename", function (req, res) {
    console.log(req.query)
    let oldDirPath = path.join(__dirname, req.query.root)
    if (req.query.root.split("/").length > 1) {
        let finalDirPath = req.query.root.split("/")
        finalDirPath[finalDirPath.length - 1] = req.query.name
        finalDirPath = finalDirPath.join("/")
        let finalDirPathF = path.join(__dirname, finalDirPath)
        if (!fs.existsSync(finalDirPathF)) {
            fs.rename(oldDirPath, finalDirPathF, (err) => {
                if (err) console.log(err)
                else {
                    res.redirect(`/filemanager?root=${finalDirPath}`)
                }
            })
        }
    }
    else {
        res.redirect(`/filemanager?root=${req.query.root}`)
    }
})

app.get("/fileRename", function (req, res) {
    console.log(req.query)
    let oldDirPath = path.join(__dirname, req.query.root)
    if (req.query.root.split("/").length > 1) {
        let finalDirPath = req.query.root.split("/")
        finalDirPath[finalDirPath.length - 1] = req.query.name
        finalDirPath = finalDirPath.join("/")
        let finalDirPathF = path.join(__dirname, finalDirPath)
        if (!fs.existsSync(finalDirPathF)) {
            fs.rename(oldDirPath, finalDirPathF, (err) => {
                if (err) console.log(err)
                else {
                    res.redirect(`/editor?id=${finalDirPath}`)
                }
            })
        }
    }
    else {
        res.redirect(`/filemanager?root=${req.query.root}`)
    }
})

app.get("/saveEdit", (req, res) => {
    const filepath = path.join(__dirname, req.query.root)
    fs.writeFile(filepath, req.query.insider, (err) => {
        if (err) throw err
    })
    res.redirect(`/editor?id=${req.query.root}`)
})


app.get("/editor", (req, res) => {
    let filePath = path.join(__dirname, req.query.id)
    if (req.query.id.split(".").at(-1) !== "jpg" && req.query.id.split(".").at(-1) !== "png") {
        fs.readFile(filePath, "utf-8", (err, data) => {
            if (err) throw err
            let info = data.split("\n")
            context = {
                content: data,
                lines: info,
                root: req.query.id
            }
            res.render('plik.hbs', context)
        })
    }
    else (res.render("graph.hbs"))
})

app.get("/settings", (q, r) => {
    fs.readFile("./static/settings.json", (err, data) => {
        console.log(data.toString());
        r.json(JSON.parse(data))
    })
})

app.post("/saveSettings", (req, res) => {
    console.log(req.body);
    console.log(settings.fontSizec);
    let text = JSON.stringify({ fontSizec: settings.fontSizec + req.body.fontSizec, themeNumber: req.body.themeNumber, themes: settings.themes })
    fs.writeFileSync("./static/settings.json", text)
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.body));
})


app.listen(PORT, function () {
    console.log("start serwera na porcie " + PORT)
})
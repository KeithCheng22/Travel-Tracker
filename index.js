import express from "express";
import pg from 'pg'
import 'dotenv/config'

let currentUserId; // to be changed according to client 

const connectToDB = async () => {
    // const db = new pg.Pool;({
    //     connectionString: process.env.POSTGRES_URL
    // })
    const db = new pg.Pool({
        host: 'localhost',
        port: 5432,
        database: 'world',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      })
    try {
        await db.connect();
        console.log("Successfully connect to Postgres")
        return db
    } catch(err) {
        console.log("Failed to connect to Postgres")
    }
}

const getVisitedCountries = async () => {
    const db = await connectToDB()
    const visited_countries = await db.query("SELECT * FROM visited_countries_v2 vc JOIN countries c ON vc.country_id = c.id JOIN users u ON vc.user_id = u.id WHERE u.id = $1", [currentUserId])
    // console.log(visited_countries)
    const country_details = visited_countries.rows.map(country => 
        ({country_code: country.country_code, 
        country_name: country.country_name,
        color: country.colour
     })
    )
    // console.log(country_details)
    return country_details
}

const getUsers = async () => {
    const db = await connectToDB()
    const result = await db.query("SELECT * FROM users")
    const users = result.rows // [{id: name:}, {}]
    return users
}

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.urlencoded())

// Get route to display all users map and data
app.route('/')
    .get(async (req, res) => {
        res.locals.res = res
        const country_details = await getVisitedCountries();
        const allUsers = await getUsers();
        res.render("index.ejs", {country_details, numOfCountries: country_details.length, allUsers, currentUserId})
    })
    .post(async (req, res) => {
        const data = req.body.currentUserId
        currentUserId = data
        res.redirect('/')
    })

// Post route for users to submit their visited country
app.post('/submit', async (req, res) => {
    // Get data from client form
    const { visited_country } = req.body

    console.log(visited_country)
    // Checking if country name is valid
    const db = await connectToDB()
    const result = await db.query("SELECT * FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%'", [visited_country.trim().toLowerCase()])
    const country = result.rows[0];
    console.log(country) // {id, country_code, country_name}

    // Check if country exists, and should be longer than 3 chars
    const country_details = await getVisitedCountries();
    const allUsers = await getUsers();
    if (country && visited_country.length > 3) {
        try {
            // Insert new country
            await db.query("INSERT INTO visited_countries_v2 (user_id, country_id) VALUES ($1, $2)", [currentUserId, country.id])
        } catch(err) {
            // If country has been added before
            console.log(err)
            return res.render("index.ejs", {country_details, error: `${country.country_name} has already been visited!`, numOfCountries: country_details.length, allUsers, currentUserId})
        }
    } else {
         // If country does not exist
        return res.render("index.ejs", {country_details, error: 'Country does not exist :(', numOfCountries: country_details.length, allUsers, currentUserId})
    }

    res.redirect('/')
})



// 2nd feature
app.get('/add_user', (req, res) => {
    return res.render('new.ejs')
})

app.post('/add_user', async (req, res) => {
    const { name, colour } = req.body
    console.log(name, colour)
    const proper_name = name[0].toUpperCase() + name.slice(1)

    const db = await connectToDB()
    try {
        await db.query('INSERT INTO users (name, colour) VALUES ($1, $2)', [proper_name, colour])
    } catch(err) {
        const err_code = err.code
        if(err_code == 23502) {
            return res.render("new.ejs", {error: `Please select a colour!`})
        }
        return res.render("new.ejs", {error: `${proper_name} has already been taken!`})
    }

    res.redirect('/')
})





app.listen(PORT, () => {`Server running on port ${PORT}`})

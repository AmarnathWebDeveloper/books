import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import pg from 'pg';
import { format } from 'date-fns';


const app = express();
const port = 3000;
const db = new pg.Client({
    user:"postgres",
    host:"localhost",
    database:"bookshelf",
    password:"562003",
    port:5432
});

db.connect();

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

async function allBooks(ratingFilter,recencyFilter){

    let query = "SELECT * FROM books ";
    const queryParams = [];

    if(ratingFilter && ratingFilter!=='all'){
        queryParams.push(ratingFilter);
        query+=`WHERE rating >= $${queryParams.length} `;
    }

    if (recencyFilter && recencyFilter !== 'all') {
        query += `ORDER BY date ${recencyFilter === 'latest' ? 'DESC' : 'ASC'}`;
    }
    console.log(query,queryParams);
    const result = await db.query(query,queryParams);
    for(let i=0;i<result.rows.length;i++){
        result.rows[i].date = format(result.rows[i].date,'dd-MM-yyyy');
    }
    return result.rows;
}
async function singleBook(request_id){
    const result = await db.query("SELECT * FROM books WHERE id = $1;",[request_id]);
    result.rows[0].date = format(result.rows[0].date,'yyyy-MM-dd');
    return result.rows[0];
}
app.get("/", async (req, res) => {
    const ratingFilter = req.query.ratingFilter || 'all';
    const recencyFilter = req.query.recencyFilter || 'all';
    
    const books = await allBooks(ratingFilter,recencyFilter);

    res.render("index.ejs", {
        books: books,
        ratingFilter: ratingFilter,
        recencyFilter: recencyFilter
    });
});

app.post("/", async (req, res) => {
    const isbn = parseInt(req.body.isbn);
    const rating = parseInt(req.body.rating);
    if(req.body.action==='new'){
        try {
            const image = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
            await db.query("INSERT INTO books (title,author,isbn,genre,rating,review,date,notes,cover_image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9);",
            [req.body.title,req.body.author,isbn,req.body.genre,rating,req.body.review,req.body.date,req.body.notes,image]);
            res.redirect("/");
        } catch(err) {
            console.error(err);
        }
    }
    if(req.body.action==='exist'){
        const result = await singleBook(req.body.requested_id);
        console.log(req.body);
        console.log(result);
        let updation = {};
        // if(req.body.title!==result.title){ updation.title = req.body.title ;}
        // if(req.body.author!==result.author){ updation.author = req.body.author ;}
        // if(isbn!==result.isbn){ updation.isbn = isbn ;}
        // if(req.body.genre!==result.genre){ updation.genre = req.body.genre ;}
        // if(rating!==result.rating){ updation.rating = rating ;}
        // if(req.body.review!==result.review){ updation.review = req.body.review ;}
        // if(req.body.date!==result.date){ updation.date = req.body.date ;}
        // if(req.body.notes!==result.notes){ updation.notes = req.body.notes ;}
        const keyToCheck = ['title','author','isbn','genre','rating','review','date','notes']

        keyToCheck.forEach(key=>{
            const reqValue = (key==='isbn' || key==='rating') ? parseInt(req.body[key]) : req.body[key];

            if(reqValue!=result[key]){
                updation[key]= reqValue;
                if(key==='isbn'){
                    updation['cover_image_url']=`https://covers.openlibrary.org/b/isbn/${reqValue}-M.jpg?default=false`;
                }
            }
        });
        console.log(Object.keys(updation));

        if(Object.keys(updation).length > 0){
            let updateQuery = 'UPDATE books SET '
            const updateValues = [];
            let valueIndex = 1;

            Object.keys(updation).forEach((key,index)=>{
               if(index > 0){ updateQuery+=', '}
                updateQuery+= `${key} = $${valueIndex} `;
                updateValues.push(updation[key]);
                valueIndex++;
            });

            updateQuery += `WHERE id = $${valueIndex}`;
            updateValues.push(parseInt(req.body.requested_id));
            console.log(updateQuery , updateValues);
            try{
                await db.query(updateQuery,updateValues);
                res.redirect("/");
            }
            catch(err){
                console.error(err);
            }
        }else{
            res.redirect("/");
        }
    }
});

app.post("/notes",async(req,res)=>{
    console.log(req.body);
    const result = await singleBook(req.body.requested_id);
    res.render("notes.ejs",{
        book:result,
    })
});

app.post("/add", (req, res) => {
    res.render("modify.ejs");
});

app.post("/modify",async(req,res)=>{
    if(req.body.action==='Edit'){
        const result = await singleBook(req.body.requested_id);
        res.render("modify.ejs",{
            book: result
        });
    }
    console.log(req.body.action);
    if(req.body.action==='Delete'){
        try{
            await db.query('DELETE FROM books WHERE id = $1',[req.body.requested_id]);
            res.redirect("/");
        }catch(err){
            console.error(err);
        }
    }
    if(req.body.action==='Home'){
        res.redirect("/");
    }
})
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

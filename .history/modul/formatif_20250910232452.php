<?php
include_once 'config.php';

$act = isset($_GET['act']) ? $_GET['act'] : 'list';

switch ($act) {
    case 'add':
        add();
        break;
    case 'edit':
        edit();
        break;
    case 'delete':
        delete();
        break;
    case 'submit_answer':
        submit_answer();
        break;
    default:
        list_items();
        break;
}

function list_items() {
    global $conn;
    $query = "SELECT * FROM formatif ORDER BY id DESC";
    $result = mysqli_query($conn, $query);
    // Display list
    echo "<h2>List Formatif</h2>";
    echo "<a href='?act=add'>Add New</a><br><br>";
    while ($row = mysqli_fetch_assoc($result)) {
        echo "<div>";
        echo "<h3>" . htmlspecialchars($row['pertanyaan']) . "</h3>";
        echo "<p>Type: " . htmlspecialchars($row['tipe']) . "</p>";
        echo "<a href='?act=edit&id=" . $row['id'] . "'>Edit</a> | ";
        echo "<a href='?act=delete&id=" . $row['id'] . "'>Delete</a>";
        echo "</div><br>";
    }
}

function add() {
    global $conn;
    if ($_SERVER['REQUEST_METHOD'] == 'POST') {
        $pertanyaan = mysqli_real_escape_string($conn, $_POST['pertanyaan']);
        $tipe = mysqli_real_escape_string($conn, $_POST['tipe']);
        $jawab = mysqli_real_escape_string($conn, $_POST['jawab']);
        $jawab_essay = mysqli_real_escape_string($conn, $_POST['jawab_essay']);
        $query = "INSERT INTO formatif (pertanyaan, tipe, jawab, jawab_essay) VALUES ('$pertanyaan', '$tipe', '$jawab', '$jawab_essay')";
        mysqli_query($conn, $query);
        header('Location: ?');
    } else {
        echo "<h2>Add Formatif</h2>";
        echo "<form method='post'>";
        echo "<label>Pertanyaan:</label><br><textarea name='pertanyaan' required></textarea><br>";
        echo "<label>Tipe:</label><br><select name='tipe' required>";
        echo "<option value='pilgan'>Pilgan</option>";
        echo "<option value='essay'>Essay</option>";
        echo "</select><br>";
        echo "<label>Jawab (for Pilgan):</label><br><input type='text' name='jawab'><br>";
        echo "<label>Jawab Essay:</label><br><textarea name='jawab_essay'></textarea><br>";
        echo "<input type='submit' value='Add'>";
        echo "</form>";
    }
}

function edit() {
    global $conn;
    $id = $_GET['id'];
    if ($_SERVER['REQUEST_METHOD'] == 'POST') {
        $pertanyaan = mysqli_real_escape_string($conn, $_POST['pertanyaan']);
        $tipe = mysqli_real_escape_string($conn, $_POST['tipe']);
        $jawab = mysqli_real_escape_string($conn, $_POST['jawab']);
        $jawab_essay = mysqli_real_escape_string($conn, $_POST['jawab_essay']);
        $query = "UPDATE formatif SET pertanyaan='$pertanyaan', tipe='$tipe', jawab='$jawab', jawab_essay='$jawab_essay' WHERE id=$id";
        mysqli_query($conn, $query);
        header('Location: ?');
    } else {
        $query = "SELECT * FROM formatif WHERE id=$id";
        $result = mysqli_query($conn, $query);
        $row = mysqli_fetch_assoc($result);
        echo "<h2>Edit Formatif</h2>";
        echo "<form method='post'>";
        echo "<label>Pertanyaan:</label><br><textarea name='pertanyaan' required>" . htmlspecialchars($row['pertanyaan']) . "</textarea><br>";
        echo "<label>Tipe:</label><br><select name='tipe' required>";
        echo "<option value='pilgan' " . ($row['tipe'] == 'pilgan' ? 'selected' : '') . ">Pilgan</option>";
        echo "<option value='essay' " . ($row['tipe'] == 'essay' ? 'selected' : '') . ">Essay</option>";
        echo "</select><br>";
        echo "<label>Jawab (for Pilgan):</label><br><input type='text' name='jawab' value='" . htmlspecialchars($row['jawab']) . "'><br>";
        echo "<label>Jawab Essay:</label><br><textarea name='jawab_essay'>" . htmlspecialchars($row['jawab_essay']) . "</textarea><br>";
        echo "<input type='submit' value='Update'>";
        echo "</form>";
    }
}

function delete() {
    global $conn;
    $id = $_GET['id'];
    $query = "DELETE FROM formatif WHERE id=$id";
    mysqli_query($conn, $query);
    header('Location: ?');
}

function submit_answer() {
    global $conn;
    $id = $_POST['id'];
    $tipe = $_POST['tipe'];
    $s_jawab = mysqli_real_escape_string($conn, $_POST['jawab']);
    $s_jawab_essay = mysqli_real_escape_string($conn, $_POST['jawab_essay']);
    
    $jawaban = ($tipe == 'pilgan') ? $s_jawab : $s_jawab_essay;
    
    $query = "INSERT INTO jawaban_formatif (formatif_id, jawaban) VALUES ($id, '$jawaban')";
    mysqli_query($conn, $query);
    echo "Answer submitted successfully!";
}
?>

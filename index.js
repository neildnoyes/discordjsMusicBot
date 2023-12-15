//imports
require('dotenv/config');
const {Client, IntentsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const { error } = require('console');
const path = require('path');

//globals 
const downloadDirectory = './downloads';
let audioPlayer, connection;
let isPaused = false;
let firstPlay = true;

//queues
const queue = [];
const fileNameQueue = [];

// initialize bot instance
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds, 
        IntentsBitField.Flags.GuildMessages, 
        IntentsBitField.Flags.MessageContent, 
        IntentsBitField.Flags.GuildVoiceStates
    ]
})

// event listener for when bot is running
client.on('ready', () => {
    console.log("The bot is online!");
})

// master event listener for when a message is sent in the server 
client.on('messageCreate', async (message) => {
    
    // ignore bot messages & messages not in server
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.content.toLowerCase() === '!join'){

        //check if author is in a voice channel
        if (message.member.voice.channel){

            const channel = message.member.voice.channel;
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            message.reply('Here I am :)');

        }else {
            message.reply('Get in a voice channel...');
        }

    }

    if (message.content.toLowerCase().startsWith('!play')){

        //check if author is in a voice channel
        if (message.member.voice.channel){

            const channel = message.member.voice.channel;
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            const videoUrl = message.content.slice('!play'.length).trim();

            if (videoUrl){
                message.reply(`Added to Queue: ${videoUrl}`);
                enqueueSong(connection, videoUrl);
            }
            else{
                message.reply('Give me a link...');
            }

        }else {
            message.reply('Get in a voice channel...');
        }

    }

    if (message.content.toLowerCase() === '!stop') {
        if (audioPlayer){
            audioPlayer.stop();
            isPaused = false;
        }
        else{
            message.reply('Nothing is playing...');
        }
    }

    if (message.content.toLowerCase() === '!pause') {
        if (audioPlayer && !isPaused){
            audioPlayer.pause();
            isPaused = true;
        }
        else{
            message.reply('Nothing is paused...');
        }
    }

    if (message.content.toLowerCase() === '!resume') {
        if (audioPlayer && isPaused){
            audioPlayer.unpause();
            isPaused = false;
        }
        else{
            message.reply('Nothing to resume...');
        }
    }

    if (message.content.toLowerCase() === '!skip') {
        skipSong();
        message.reply('Skipping song...');
    }

    if (message.content.toLowerCase() === '!leave') {
        if (connection){
            connection.destroy();
            audioPlayer.stop();
            connection = null;
            audioPlayer = null;
            message.reply('Leaving...');
        }
    }

});

/**
 * function: playNextSong
 * 
 * def: shifts queue to get the next song and sends it to audioPlayer to play
 */
function playNextSong(){

    if (queue.length > 0){
        const resource = queue.shift();
        audioPlayer.play(resource);
    }

}

/**
 * function: deleteFile
 * 
 * @param filePath: absolute filepath to file we want to delete
 * 
 * def: deletes the specified file
 */
function deleteFile(filePath){

    console.log('Deleting file:', filePath);

    if (fs.existsSync(filePath)){
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                console.log('File deleted successfully.');
            }
        });
    }else{
        console.log('File does not exist:', filePath);
    }
    
}

/**
 * function: handleAudioPlayerStateChange
 * 
 * @param filePath: absolute filepath to file we want to delete
 * 
 * def: once audioPlayer is idle (current song ends), delete the current song file and play next song
 */
function handleAudioPlayerStateChange(filePath){
    if (audioPlayer.state.status === 'idle') {
        deleteFile(filePath);
        playNextSong();
    }
}


/**
 * function: enqueueSong
 * 
 * @param connection: voice connection object
 * @param ytURL: link to youtube video
 * 
 * def: downloads the given link and adds it to the queue of songs
 */
function enqueueSong(connection, ytURL){
    const stream = ytdl(ytURL, {filter: 'audioonly'});
    const timestamp = new Date().getTime();
    const uniqueFileName = `audio_${timestamp}.mp3`;
    const filePath = path.join(downloadDirectory, uniqueFileName);

    ffmpeg()
    .input(stream)
    .audioCodec('libmp3lame')
    .on('end', () => {
      const resource = createAudioResource(fs.createReadStream(filePath), { inputType: StreamType.Arbitrary });

      if (!audioPlayer) {
        audioPlayer = createAudioPlayer();
        connection.subscribe(audioPlayer);
      }

      queue.push(resource);
      fileNameQueue.push(filePath);
      audioPlayer.on('stateChange', () => handleAudioPlayerStateChange(filePath));
      
      if (firstPlay){
        const this_song = queue.shift();
        audioPlayer.play(this_song);
        firstPlay = false;
      }

    })
    .on('error', (err) => {
      console.error('Error:', err);
    })
    .save(filePath);

}

/**
 * function: skipSong
 * 
 * def: deletes the file for the current song, and shifts the queue to play next song
 */
function skipSong(){

    //play next
    playNextSong();

    //remove current song from storage
    if (fileNameQueue.length > 0){
        const toRemove = fileNameQueue.shift();
        deleteFile(toRemove);
    }
    
}


client.login(process.env.TOKEN);
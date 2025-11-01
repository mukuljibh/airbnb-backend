import Queue from 'promise-queue';

let priorityQueue: Queue | null = null;

function getPQueueInstance() {
   if (!priorityQueue) {
      priorityQueue = new Queue(1, Infinity);
   }
   return priorityQueue;
}

export default getPQueueInstance;
